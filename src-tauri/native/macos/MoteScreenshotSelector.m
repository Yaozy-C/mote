#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <ImageIO/ImageIO.h>
#import <ScreenCaptureKit/ScreenCaptureKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

#include <math.h>
#include <stdio.h>
#include <unistd.h>

static void selector_error(char *buffer, size_t length, NSString *message) {
    if (!buffer || length == 0) return;
    snprintf(buffer, length, "%s", message.UTF8String ?: "Unknown screenshot error");
}

static CGFloat primary_top(void) {
    NSScreen *screen = NSScreen.screens.firstObject;
    return screen ? NSMaxY(screen.frame) : 0;
}

static NSRect appkit_rect_from_cg(CGRect rect) {
    return NSMakeRect(rect.origin.x, primary_top() - CGRectGetMaxY(rect), rect.size.width, rect.size.height);
}

static CGRect cg_rect_from_appkit(NSRect rect) {
    return CGRectMake(rect.origin.x, primary_top() - NSMaxY(rect), rect.size.width, rect.size.height);
}

static CGImageRef capture_screen_rect(CGRect rect, NSError **result_error) {
    if (@available(macOS 15.2, *)) {
        __block CGImageRef result = nil;
        __block NSError *capture_error = nil;
        dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
        [SCScreenshotManager captureImageInRect:rect completionHandler:^(CGImageRef image, NSError *error) {
            if (image) result = CGImageRetain(image);
            capture_error = error;
            dispatch_semaphore_signal(semaphore);
        }];
        dispatch_semaphore_wait(semaphore, dispatch_time(DISPATCH_TIME_NOW, 12 * NSEC_PER_SEC));
        if (result_error) *result_error = capture_error;
        return result;
    }
    return CGWindowListCreateImage(
        rect,
        kCGWindowListOptionOnScreenOnly,
        kCGNullWindowID,
        kCGWindowImageBestResolution
    );
}

static NSRect all_screens_frame(void) {
    NSRect result = NSZeroRect;
    for (NSScreen *screen in NSScreen.screens) {
        result = NSIsEmptyRect(result) ? screen.frame : NSUnionRect(result, screen.frame);
    }
    return result;
}

static NSRect standardized_rect(NSRect rect) {
    CGFloat opposite_x = rect.origin.x + rect.size.width;
    CGFloat opposite_y = rect.origin.y + rect.size.height;
    return NSMakeRect(
        MIN(rect.origin.x, opposite_x),
        MIN(rect.origin.y, opposite_y),
        fabs(rect.size.width),
        fabs(rect.size.height)
    );
}

static NSArray<NSValue *> *candidate_window_rects(void) {
    CFArrayRef info = CGWindowListCopyWindowInfo(
        kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
        kCGNullWindowID
    );
    NSMutableArray<NSValue *> *result = [NSMutableArray array];
    pid_t own_pid = getpid();
    for (NSDictionary *window in (__bridge NSArray *)info) {
        if ([window[(id)kCGWindowOwnerPID] intValue] == own_pid) continue;
        if ([window[(id)kCGWindowLayer] intValue] != 0) continue;
        if ([window[(id)kCGWindowAlpha] doubleValue] <= 0.01) continue;
        CGRect bounds = CGRectZero;
        if (!CGRectMakeWithDictionaryRepresentation((__bridge CFDictionaryRef)window[(id)kCGWindowBounds], &bounds)) continue;
        if (bounds.size.width < 80 || bounds.size.height < 60) continue;
        [result addObject:[NSValue valueWithRect:appkit_rect_from_cg(bounds)]];
    }
    if (info) CFRelease(info);
    return result;
}

static BOOL write_selector_png(CGImageRef image, const char *path, char *error, size_t error_length) {
    NSURL *url = [NSURL fileURLWithPath:[NSString stringWithUTF8String:path]];
    CGImageDestinationRef destination = CGImageDestinationCreateWithURL(
        (__bridge CFURLRef)url,
        (__bridge CFStringRef)UTTypePNG.identifier,
        1,
        NULL
    );
    if (!destination) {
        selector_error(error, error_length, @"Mote could not prepare the screenshot file.");
        return NO;
    }
    CGImageDestinationAddImage(destination, image, NULL);
    BOOL saved = CGImageDestinationFinalize(destination);
    CFRelease(destination);
    if (!saved) selector_error(error, error_length, @"Mote could not save the screenshot.");
    return saved;
}

@interface MoteCapturePanel : NSPanel
@end

@implementation MoteCapturePanel
- (BOOL)canBecomeKeyWindow { return YES; }
@end

@interface MoteSelectionView : NSView
@property(nonatomic, strong) NSImage *snapshot;
@property(nonatomic, strong) NSArray<NSValue *> *windowRects;
@property(nonatomic) NSRect hoveredScreenRect;
@property(nonatomic) NSRect selectedLocalRect;
@property(nonatomic) NSRect resultScreenRect;
@property(nonatomic) NSPoint downPoint;
@property(nonatomic) BOOL dragging;
@end

@implementation MoteSelectionView
- (BOOL)acceptsFirstResponder { return YES; }

- (void)updateTrackingAreas {
    [super updateTrackingAreas];
    for (NSTrackingArea *area in self.trackingAreas) [self removeTrackingArea:area];
    NSTrackingAreaOptions options = NSTrackingMouseMoved | NSTrackingActiveAlways | NSTrackingInVisibleRect;
    [self addTrackingArea:[[NSTrackingArea alloc] initWithRect:self.bounds options:options owner:self userInfo:nil]];
}

- (NSRect)localRectForScreenRect:(NSRect)screenRect {
    return [self.window convertRectFromScreen:screenRect];
}

- (void)drawRect:(NSRect)dirtyRect {
    [self.snapshot drawInRect:self.bounds fromRect:NSZeroRect operation:NSCompositingOperationCopy fraction:1];
    [[NSColor colorWithWhite:0 alpha:.34] setFill];
    NSRectFillUsingOperation(self.bounds, NSCompositingOperationSourceOver);
    NSRect focus = !NSIsEmptyRect(self.selectedLocalRect)
        ? self.selectedLocalRect
        : [self localRectForScreenRect:self.hoveredScreenRect];
    if (!NSIsEmptyRect(focus)) {
        [NSGraphicsContext saveGraphicsState];
        [[NSBezierPath bezierPathWithRect:focus] addClip];
        [self.snapshot drawInRect:self.bounds fromRect:NSZeroRect operation:NSCompositingOperationCopy fraction:1];
        [NSGraphicsContext restoreGraphicsState];
        NSBezierPath *border = [NSBezierPath bezierPathWithRoundedRect:NSInsetRect(focus, 1, 1) xRadius:4 yRadius:4];
        border.lineWidth = 2;
        [[NSColor colorWithSRGBRed:.04 green:.52 blue:1 alpha:1] setStroke];
        [border stroke];
    }
}

- (void)mouseMoved:(NSEvent *)event {
    if (self.dragging) return;
    NSPoint screenPoint = [self.window convertPointToScreen:event.locationInWindow];
    self.hoveredScreenRect = NSZeroRect;
    for (NSValue *value in self.windowRects) {
        if (NSPointInRect(screenPoint, value.rectValue)) {
            self.hoveredScreenRect = value.rectValue;
            break;
        }
    }
    self.selectedLocalRect = NSZeroRect;
    [self setNeedsDisplay:YES];
}

- (void)mouseDown:(NSEvent *)event {
    self.downPoint = [self convertPoint:event.locationInWindow fromView:nil];
    self.dragging = NO;
    self.selectedLocalRect = [self localRectForScreenRect:self.hoveredScreenRect];
}

- (void)mouseDragged:(NSEvent *)event {
    NSPoint point = [self convertPoint:event.locationInWindow fromView:nil];
    if (!self.dragging && hypot(point.x - self.downPoint.x, point.y - self.downPoint.y) >= 4) self.dragging = YES;
    if (!self.dragging) return;
    NSRect rect = NSMakeRect(self.downPoint.x, self.downPoint.y, point.x - self.downPoint.x, point.y - self.downPoint.y);
    self.selectedLocalRect = NSIntersectionRect(standardized_rect(rect), self.bounds);
    [self setNeedsDisplay:YES];
}

- (void)mouseUp:(NSEvent *)event {
    NSRect selection = self.dragging ? self.selectedLocalRect : [self localRectForScreenRect:self.hoveredScreenRect];
    if (selection.size.width < 2 || selection.size.height < 2) return;
    self.resultScreenRect = [self.window convertRectToScreen:selection];
    [NSApp stopModalWithCode:NSModalResponseOK];
}

- (void)keyDown:(NSEvent *)event {
    if (event.keyCode == 53) [NSApp stopModalWithCode:NSModalResponseCancel];
    else [super keyDown:event];
}

- (void)resetCursorRects {
    [self addCursorRect:self.bounds cursor:NSCursor.crosshairCursor];
}
@end

static int run_selector(const char *output_path, char *error, size_t error_length) {
    NSRect desktop = all_screens_frame();
    if (NSIsEmptyRect(desktop)) {
        selector_error(error, error_length, @"Mote could not find an active display.");
        return 2;
    }
    NSError *desktop_error = nil;
    CGImageRef desktop_image = capture_screen_rect(cg_rect_from_appkit(desktop), &desktop_error);
    if (!desktop_image) {
        selector_error(error, error_length, desktop_error.localizedDescription ?: @"Screen Recording access is required to start a screenshot.");
        return 3;
    }

    MoteCapturePanel *panel = [[MoteCapturePanel alloc] initWithContentRect:desktop
        styleMask:NSWindowStyleMaskBorderless backing:NSBackingStoreBuffered defer:NO];
    panel.level = NSScreenSaverWindowLevel;
    panel.opaque = YES;
    panel.backgroundColor = NSColor.blackColor;
    panel.collectionBehavior = NSWindowCollectionBehaviorCanJoinAllSpaces | NSWindowCollectionBehaviorFullScreenAuxiliary;
    panel.acceptsMouseMovedEvents = YES;
    panel.releasedWhenClosed = NO;

    MoteSelectionView *view = [[MoteSelectionView alloc] initWithFrame:NSMakeRect(0, 0, desktop.size.width, desktop.size.height)];
    view.snapshot = [[NSImage alloc] initWithCGImage:desktop_image size:desktop.size];
    view.windowRects = candidate_window_rects();
    panel.contentView = view;
    [NSApp activateIgnoringOtherApps:YES];
    [panel makeKeyAndOrderFront:nil];
    [panel makeFirstResponder:view];
    NSModalResponse response = [NSApp runModalForWindow:panel];
    [panel orderOut:nil];
    if (response != NSModalResponseOK) {
        CGImageRelease(desktop_image);
        return 1;
    }

    NSRect selected = view.resultScreenRect;
    CGRect desktop_rect = cg_rect_from_appkit(desktop);
    CGRect capture_rect = cg_rect_from_appkit(selected);
    CGFloat scale_x = (CGFloat)CGImageGetWidth(desktop_image) / desktop_rect.size.width;
    CGFloat scale_y = (CGFloat)CGImageGetHeight(desktop_image) / desktop_rect.size.height;
    CGRect pixel_rect = CGRectMake(
        floor((capture_rect.origin.x - desktop_rect.origin.x) * scale_x),
        floor((capture_rect.origin.y - desktop_rect.origin.y) * scale_y),
        ceil(capture_rect.size.width * scale_x),
        ceil(capture_rect.size.height * scale_y)
    );
    CGRect image_bounds = CGRectMake(0, 0, CGImageGetWidth(desktop_image), CGImageGetHeight(desktop_image));
    pixel_rect = CGRectIntersection(pixel_rect, image_bounds);
    CGImageRef capture = CGRectIsEmpty(pixel_rect) ? nil : CGImageCreateWithImageInRect(desktop_image, pixel_rect);
    CGImageRelease(desktop_image);
    if (!capture) {
        selector_error(error, error_length, @"Mote could not capture the selected area.");
        return 4;
    }
    BOOL saved = write_selector_png(capture, output_path, error, error_length);
    CGImageRelease(capture);
    return saved ? 0 : 5;
}

int mote_select_screenshot(const char *output_path, char *error, size_t error_length) {
    @autoreleasepool {
        __block int status = 0;
        void (^work)(void) = ^{ status = run_selector(output_path, error, error_length); };
        if (NSThread.isMainThread) work(); else dispatch_sync(dispatch_get_main_queue(), work);
        return status;
    }
}
