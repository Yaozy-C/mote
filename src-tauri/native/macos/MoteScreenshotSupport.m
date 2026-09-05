#import "MoteScreenshotSupport.h"

#import <ImageIO/ImageIO.h>
#import <ScreenCaptureKit/ScreenCaptureKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

#include <math.h>
#include <stdio.h>
#include <unistd.h>

@implementation MoteDisplaySnapshot
- (void)dealloc {
  if (_image)
    CGImageRelease(_image);
}
@end

void MoteSelectorError(char *buffer, size_t length, NSString *message) {
  if (!buffer || length == 0)
    return;
  snprintf(buffer, length, "%s", message.UTF8String ?: "Unknown screenshot error");
}

static SCShareableContent *shareable_content(NSError **resultError) {
  __block SCShareableContent *result = nil;
  __block NSError *captureError = nil;
  dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
  [SCShareableContent getShareableContentExcludingDesktopWindows:NO
                                             onScreenWindowsOnly:YES
                                               completionHandler:^(SCShareableContent *content, NSError *error) {
                                                 result = content;
                                                 captureError = error;
                                                 dispatch_semaphore_signal(semaphore);
                                               }];
  dispatch_semaphore_wait(semaphore, dispatch_time(DISPATCH_TIME_NOW, 12 * NSEC_PER_SEC));
  if (resultError)
    *resultError = captureError;
  return result;
}

static CGImageRef capture_display(SCDisplay *display, NSScreen *screen, NSError **resultError) {
  SCContentFilter *filter = [[SCContentFilter alloc] initWithDisplay:display excludingWindows:@[]];
  SCStreamConfiguration *configuration = [SCStreamConfiguration new];
  CGDisplayModeRef mode = CGDisplayCopyDisplayMode(display.displayID);
  size_t pixelWidth = mode ? CGDisplayModeGetPixelWidth(mode) : 0;
  size_t pixelHeight = mode ? CGDisplayModeGetPixelHeight(mode) : 0;
  if (mode)
    CGDisplayModeRelease(mode);
  CGFloat scale = MAX(1.0, screen.backingScaleFactor);
  configuration.width = pixelWidth ?: (size_t)llround(screen.frame.size.width * scale);
  configuration.height = pixelHeight ?: (size_t)llround(screen.frame.size.height * scale);
  configuration.showsCursor = NO;
  configuration.shouldBeOpaque = YES;
  configuration.capturesAudio = NO;

  __block CGImageRef result = nil;
  __block NSError *captureError = nil;
  dispatch_semaphore_t semaphore = dispatch_semaphore_create(0);
  [SCScreenshotManager captureImageWithFilter:filter
                                configuration:configuration
                            completionHandler:^(CGImageRef image, NSError *error) {
                              if (image)
                                result = CGImageRetain(image);
                              captureError = error;
                              dispatch_semaphore_signal(semaphore);
                            }];
  dispatch_semaphore_wait(semaphore, dispatch_time(DISPATCH_TIME_NOW, 12 * NSEC_PER_SEC));
  if (resultError)
    *resultError = captureError;
  return result;
}

NSArray<MoteDisplaySnapshot *> *MoteCaptureDisplaySnapshots(NSError **resultError) {
  NSError *contentError = nil;
  SCShareableContent *content = shareable_content(&contentError);
  if (!content) {
    if (resultError)
      *resultError = contentError;
    return nil;
  }
  NSMutableArray<MoteDisplaySnapshot *> *result = [NSMutableArray array];
  for (NSScreen *screen in NSScreen.screens) {
    CGDirectDisplayID displayID = [screen.deviceDescription[@"NSScreenNumber"] unsignedIntValue];
    SCDisplay *match = nil;
    for (SCDisplay *display in content.displays) {
      if (display.displayID == displayID) {
        match = display;
        break;
      }
    }
    if (!match)
      continue;
    NSError *captureError = nil;
    CGImageRef image = capture_display(match, screen, &captureError);
    if (!image) {
      if (resultError)
        *resultError = captureError;
      return nil;
    }
    MoteDisplaySnapshot *snapshot = [MoteDisplaySnapshot new];
    snapshot.screen = screen;
    snapshot.image = image;
    [result addObject:snapshot];
  }
  return result;
}

static CGFloat primary_top(void) {
  NSScreen *screen = NSScreen.screens.firstObject;
  return screen ? NSMaxY(screen.frame) : 0;
}

NSArray<NSValue *> *MoteCandidateWindowRects(void) {
  CFArrayRef info = CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
                                               kCGNullWindowID);
  NSMutableArray<NSValue *> *result = [NSMutableArray array];
  pid_t ownPID = getpid();
  for (NSDictionary *window in (__bridge NSArray *)info) {
    if ([window[(id)kCGWindowOwnerPID] intValue] == ownPID)
      continue;
    // Include floating app windows, while excluding menus, Dock and overlays.
    NSInteger layer = [window[(id)kCGWindowLayer] integerValue];
    if (layer < 0 || layer >= CGWindowLevelForKey(kCGMainMenuWindowLevelKey))
      continue;
    if ([window[(id)kCGWindowAlpha] doubleValue] <= 0.01)
      continue;
    CGRect bounds = CGRectZero;
    if (!CGRectMakeWithDictionaryRepresentation((__bridge CFDictionaryRef)window[(id)kCGWindowBounds], &bounds))
      continue;
    if (bounds.size.width < 2 || bounds.size.height < 2)
      continue;
    NSRect rect =
        NSMakeRect(bounds.origin.x, primary_top() - CGRectGetMaxY(bounds), bounds.size.width, bounds.size.height);
    [result addObject:[NSValue valueWithRect:rect]];
  }
  if (info)
    CFRelease(info);
  return result;
}

BOOL MoteWriteDisplaySelection(MoteDisplaySnapshot *snapshot, NSRect localSelection, const char *path, char *error,
                               size_t errorLength) {
  CGFloat scaleX = (CGFloat)CGImageGetWidth(snapshot.image) / snapshot.screen.frame.size.width;
  CGFloat scaleY = (CGFloat)CGImageGetHeight(snapshot.image) / snapshot.screen.frame.size.height;
  CGRect pixels = CGRectMake(floor(NSMinX(localSelection) * scaleX),
                             floor((snapshot.screen.frame.size.height - NSMaxY(localSelection)) * scaleY),
                             ceil(NSWidth(localSelection) * scaleX), ceil(NSHeight(localSelection) * scaleY));
  CGRect bounds = CGRectMake(0, 0, CGImageGetWidth(snapshot.image), CGImageGetHeight(snapshot.image));
  pixels = CGRectIntersection(pixels, bounds);
  CGImageRef cropped = CGRectIsEmpty(pixels) ? nil : CGImageCreateWithImageInRect(snapshot.image, pixels);
  if (!cropped) {
    MoteSelectorError(error, errorLength, @"Mote could not capture the selected area.");
    return NO;
  }
  NSURL *url = [NSURL fileURLWithPath:[NSString stringWithUTF8String:path]];
  CGImageDestinationRef destination =
      CGImageDestinationCreateWithURL((__bridge CFURLRef)url, (__bridge CFStringRef)UTTypePNG.identifier, 1, NULL);
  BOOL saved = destination != nil;
  if (destination) {
    CGImageDestinationAddImage(destination, cropped, NULL);
    saved = CGImageDestinationFinalize(destination);
    CFRelease(destination);
  }
  CGImageRelease(cropped);
  if (!saved)
    MoteSelectorError(error, errorLength, @"Mote could not save the screenshot.");
  return saved;
}
