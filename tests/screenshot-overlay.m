#import "MoteScreenshotView.h"
#include <assert.h>

@interface TestScreen : NSScreen
@end
@implementation TestScreen
- (NSRect)frame { return NSMakeRect(-200, 100, 200, 200); }
@end

int main(void) {
  @autoreleasepool {
    NSBitmapImageRep *source = [[NSBitmapImageRep alloc]
        initWithBitmapDataPlanes:NULL pixelsWide:200 pixelsHigh:200 bitsPerSample:8
        samplesPerPixel:4 hasAlpha:YES isPlanar:NO colorSpaceName:NSDeviceRGBColorSpace
        bytesPerRow:0 bitsPerPixel:0];
    memset(source.bitmapData, 255, source.bytesPerRow * source.pixelsHigh);
    NSImage *image = [[NSImage alloc] initWithSize:NSMakeSize(200, 200)];
    [image addRepresentation:source];
    MoteSelectionView *view = [[MoteSelectionView alloc] initWithFrame:NSMakeRect(0, 0, 200, 200)];
    view.snapshot = image;
    view.mousePoint = NSMakePoint(-200, -200); // Keep the loupe outside the test bitmap.
    [view setValue:[NSValue valueWithRect:NSMakeRect(80, 80, 40, 40)] forKey:@"hoveredRect"];
    NSBitmapImageRep *output = [source copy];
    [NSGraphicsContext saveGraphicsState];
    [NSGraphicsContext setCurrentContext:[NSGraphicsContext graphicsContextWithBitmapImageRep:output]];
    [view drawRect:view.bounds];
    [NSGraphicsContext restoreGraphicsState];
    NSColor *outside = [[output colorAtX:10 y:10] colorUsingColorSpace:NSColorSpace.deviceRGBColorSpace];
    NSColor *inside = [[output colorAtX:100 y:100] colorUsingColorSpace:NSColorSpace.deviceRGBColorSpace];
    assert(outside.redComponent > .65 && outside.redComponent < .85);
    assert(outside.alphaComponent > .99);
    assert(inside.redComponent > .99);
    MoteDisplaySnapshot *display = [MoteDisplaySnapshot new];
    display.screen = [TestScreen new];
    view.displaySnapshot = display;
    view.windowRects = @[[NSValue valueWithRect:NSMakeRect(-180, 120, 60, 60)],
                         [NSValue valueWithRect:NSMakeRect(-200, 100, 190, 190)]];
    [view updateHover:NSMakePoint(30, 30)];
    assert(NSEqualRects([[view valueForKey:@"hoveredRect"] rectValue], NSMakeRect(20, 20, 60, 60)));
    // A click elsewhere must hit-test again instead of accepting the stale front window.
    NSEvent *click = [NSEvent mouseEventWithType:NSEventTypeLeftMouseDown
        location:NSMakePoint(150, 150) modifierFlags:0 timestamp:0 windowNumber:0
        context:nil eventNumber:1 clickCount:1 pressure:1];
    [view mouseDown:click];
    assert(NSEqualRects(view.selection, NSMakeRect(0, 0, 190, 190)));
    puts("Screenshot overlay: background remains visible and opaque; selection stays undimmed.");
    puts("Window hit testing: frontmost match, offset display and fresh click position passed.");
  }
}
