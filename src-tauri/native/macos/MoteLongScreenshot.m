#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>
#import <CoreGraphics/CoreGraphics.h>
#import <ImageIO/ImageIO.h>
#import <ScreenCaptureKit/ScreenCaptureKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

#include <math.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

static void set_error(char *buffer, size_t length, NSString *message) {
    if (!buffer || length == 0) return;
    const char *value = message.UTF8String ?: "Unknown capture error";
    snprintf(buffer, length, "%s", value);
}

static SCShareableContent *shareable_content(NSError **result_error) {
    __block SCShareableContent *result = nil;
    __block NSError *capture_error = nil;
    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
    [SCShareableContent getShareableContentExcludingDesktopWindows:YES
                                               onScreenWindowsOnly:YES
                                                 completionHandler:^(SCShareableContent *content, NSError *error) {
        result = content;
        capture_error = error;
        dispatch_semaphore_signal(semaphore);
    }];
    dispatch_semaphore_wait(semaphore, dispatch_time(DISPATCH_TIME_NOW, 12 * NSEC_PER_SEC));
    if (result_error) *result_error = capture_error;
    return result;
}

static CGImageRef capture_frame(SCContentFilter *filter, SCStreamConfiguration *configuration, NSError **result_error) {
    __block CGImageRef result = nil;
    __block NSError *capture_error = nil;
    dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
    [SCScreenshotManager captureImageWithFilter:filter configuration:configuration completionHandler:^(CGImageRef image, NSError *error) {
        if (image) result = CGImageRetain(image);
        capture_error = error;
        dispatch_semaphore_signal(semaphore);
    }];
    dispatch_semaphore_wait(semaphore, dispatch_time(DISPATCH_TIME_NOW, 12 * NSEC_PER_SEC));
    if (result_error) *result_error = capture_error;
    return result;
}

static uint8_t *rgba_from_image(CGImageRef image, size_t width, size_t height) {
    size_t bytes_per_row = width * 4;
    uint8_t *pixels = calloc(height, bytes_per_row);
    if (!pixels) return NULL;
    CGColorSpaceRef color_space = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
    CGContextRef context = CGBitmapContextCreate(pixels, width, height, 8, bytes_per_row, color_space,
        kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big);
    CGColorSpaceRelease(color_space);
    if (!context) {
        free(pixels);
        return NULL;
    }
    CGContextSetRGBFillColor(context, 1, 1, 1, 1);
    CGContextFillRect(context, CGRectMake(0, 0, width, height));
    CGContextDrawImage(context, CGRectMake(0, 0, width, height), image);
    CGContextRelease(context);
    return pixels;
}

static inline int luminance(const uint8_t *pixels, size_t width, size_t x, size_t y) {
    const uint8_t *pixel = pixels + (y * width + x) * 4;
    return (pixel[0] * 3 + pixel[1] * 6 + pixel[2]) / 10;
}

static inline int edge_value(const uint8_t *pixels, size_t width, size_t x, size_t y) {
    int horizontal = abs(luminance(pixels, width, x + 2, y) - luminance(pixels, width, x - 2, y));
    int vertical = abs(luminance(pixels, width, x, y + 2) - luminance(pixels, width, x, y - 2));
    return horizontal + vertical;
}

static double same_position_difference(const uint8_t *before, const uint8_t *after, size_t width, size_t height) {
    size_t top = MAX((size_t)8, height / 5);
    size_t bottom = MAX((size_t)8, height / 12);
    size_t left = MAX((size_t)8, width / 10);
    size_t right = width - left;
    double total = 0;
    size_t samples = 0;
    for (size_t y = top; y + bottom + 3 < height; y += 10) {
        for (size_t x = left; x + 3 < right; x += 10) {
            total += abs(edge_value(before, width, x, y) - edge_value(after, width, x, y));
            samples++;
        }
    }
    return samples ? total / samples : 0;
}

static size_t estimate_shift(const uint8_t *before, const uint8_t *after, size_t width, size_t height, double *confidence) {
    size_t top = MAX((size_t)10, height / 5);
    size_t bottom = MAX((size_t)10, height / 12);
    size_t left = MAX((size_t)10, width / 9);
    size_t right = width - left;
    size_t maximum = MIN(height * 3 / 4, (size_t)900);
    size_t best_shift = 0;
    double best_score = HUGE_VAL;
    for (size_t shift = 12; shift <= maximum; shift += 4) {
        if (top + shift + bottom + 4 >= height) break;
        double total = 0;
        size_t samples = 0;
        for (size_t y = top; y + shift + bottom + 3 < height; y += 12) {
            for (size_t x = left; x + 3 < right; x += 12) {
                int a = edge_value(before, width, x, y + shift);
                int b = edge_value(after, width, x, y);
                total += abs(a - b);
                samples++;
            }
        }
        double score = samples ? total / samples : HUGE_VAL;
        if (score < best_score) {
            best_score = score;
            best_shift = shift;
        }
    }
    if (confidence) *confidence = best_score;
    return best_shift;
}

static BOOL post_scroll(pid_t pid, CGRect frame) {
    int32_t distance = -(int32_t)MAX(180.0, MIN(620.0, frame.size.height * 0.58));
    CGEventRef event = CGEventCreateScrollWheelEvent(NULL, kCGScrollEventUnitPixel, 1, distance);
    if (!event) return NO;
    CGEventSetLocation(event, CGPointMake(CGRectGetMidX(frame), CGRectGetMidY(frame)));
    CGEventSetIntegerValueField(event, kCGScrollWheelEventIsContinuous, 1);
    CGEventSetIntegerValueField(event, kCGScrollWheelEventPointDeltaAxis1, distance);
    CGEventPostToPid(pid, event);
    CFRelease(event);
    return YES;
}

static BOOL write_png(const char *path, uint8_t *pixels, size_t width, size_t height, char *error, size_t error_length) {
    CGDataProviderRef provider = CGDataProviderCreateWithData(NULL, pixels, width * height * 4, NULL);
    CGColorSpaceRef color_space = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
    CGImageRef image = CGImageCreate(width, height, 8, 32, width * 4, color_space,
        kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big, provider, NULL, false, kCGRenderingIntentDefault);
    NSURL *url = [NSURL fileURLWithPath:[NSString stringWithUTF8String:path]];
    CGImageDestinationRef destination = CGImageDestinationCreateWithURL((__bridge CFURLRef)url,
        (__bridge CFStringRef)UTTypePNG.identifier, 1, NULL);
    BOOL success = destination && image;
    if (success) {
        CGImageDestinationAddImage(destination, image, NULL);
        success = CGImageDestinationFinalize(destination);
    }
    if (destination) CFRelease(destination);
    if (image) CGImageRelease(image);
    CGColorSpaceRelease(color_space);
    CGDataProviderRelease(provider);
    if (!success) set_error(error, error_length, @"Mote could not write the stitched PNG.");
    return success;
}

bool mote_screen_capture_preflight(void) {
    return CGPreflightScreenCaptureAccess();
}

bool mote_screen_capture_request(void) {
    return CGRequestScreenCaptureAccess();
}

bool mote_accessibility_request(void) {
    NSDictionary *options = @{(__bridge NSString *)kAXTrustedCheckOptionPrompt: @YES};
    return AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options);
}

int mote_capture_long_screenshot(const char *bundle_id, const char *output_path, int max_steps,
                                 char *error, size_t error_length) {
    @autoreleasepool {
        if (@available(macOS 14.0, *)) {
            if (!bundle_id || !output_path) {
                set_error(error, error_length, @"The capture target is missing.");
                return 2;
            }
            NSError *content_error = nil;
            SCShareableContent *content = shareable_content(&content_error);
            if (!content) {
                set_error(error, error_length, content_error.localizedDescription ?: @"Screen Recording access is required.");
                return 3;
            }
            NSString *target_bundle = [NSString stringWithUTF8String:bundle_id];
            SCWindow *target = nil;
            double largest_area = 0;
            for (SCWindow *window in content.windows) {
                if (![window.owningApplication.bundleIdentifier isEqualToString:target_bundle]) continue;
                if (!window.isOnScreen || window.windowLayer != 0 || window.frame.size.width < 260 || window.frame.size.height < 220) continue;
                double area = window.frame.size.width * window.frame.size.height;
                if (area > largest_area) { target = window; largest_area = area; }
            }
            if (!target) {
                set_error(error, error_length, @"Mote could not find a visible window for the target app.");
                return 4;
            }
            pid_t pid = target.owningApplication.processID;
            NSRunningApplication *application = [NSRunningApplication runningApplicationWithProcessIdentifier:pid];
            [application activateWithOptions:NSApplicationActivateIgnoringOtherApps];
            usleep(220000);

            SCContentFilter *filter = [[SCContentFilter alloc] initWithDesktopIndependentWindow:target];
            SCStreamConfiguration *configuration = [SCStreamConfiguration new];
            configuration.width = (size_t)MAX(1.0, target.frame.size.width);
            configuration.height = (size_t)MAX(1.0, target.frame.size.height);
            configuration.showsCursor = NO;
            configuration.ignoreShadowsSingleWindow = YES;
            configuration.shouldBeOpaque = YES;
            NSError *frame_error = nil;
            CGImageRef first_image = capture_frame(filter, configuration, &frame_error);
            if (!first_image) {
                set_error(error, error_length, frame_error.localizedDescription ?: @"Mote could not capture the target window.");
                return 5;
            }
            size_t width = configuration.width;
            size_t height = configuration.height;
            uint8_t *previous = rgba_from_image(first_image, width, height);
            CGImageRelease(first_image);
            if (!previous) {
                set_error(error, error_length, @"Mote ran out of memory while preparing the first frame.");
                return 6;
            }
            size_t capacity_rows = MIN((size_t)32000, height + (size_t)MAX(1, max_steps) * height * 2 / 3);
            uint8_t *stitched = malloc(capacity_rows * width * 4);
            if (!stitched) { free(previous); set_error(error, error_length, @"The long screenshot is too large."); return 7; }
            memcpy(stitched, previous, width * height * 4);
            size_t stitched_rows = height;
            int still_frames = 0;

            for (int step = 0; step < MAX(1, max_steps); step++) {
                if (CGEventSourceKeyState(kCGEventSourceStateCombinedSessionState, 53)) break;
                if (!post_scroll(pid, target.frame)) break;
                usleep(360000);
                CGImageRef next_image = capture_frame(filter, configuration, &frame_error);
                if (!next_image) break;
                uint8_t *next = rgba_from_image(next_image, width, height);
                CGImageRelease(next_image);
                if (!next) break;
                double movement = same_position_difference(previous, next, width, height);
                if (movement < 1.15) still_frames++; else still_frames = 0;
                if (still_frames >= 2) { free(next); break; }
                double match_score = 0;
                size_t shift = estimate_shift(previous, next, width, height, &match_score);
                if (shift < 12 || match_score > 34.0 || stitched_rows + shift > capacity_rows) { free(next); break; }
                memcpy(stitched + stitched_rows * width * 4,
                       next + (height - shift) * width * 4,
                       shift * width * 4);
                stitched_rows += shift;
                free(previous);
                previous = next;
            }
            BOOL saved = write_png(output_path, stitched, width, stitched_rows, error, error_length);
            free(previous);
            free(stitched);
            return saved ? 0 : 8;
        }
        set_error(error, error_length, @"Scrolling screenshots require macOS 14 or later.");
        return 9;
    }
}
