#import "MoteScreenshotView.h"

#include <math.h>

typedef NS_ENUM(NSInteger, MoteSelectionMode) {
  MoteSelectionModeHover,
  MoteSelectionModeDrawing,
  MoteSelectionModeEditing,
  MoteSelectionModeMoving,
  MoteSelectionModeResizing,
};

@interface MoteSelectionView ()
@property(nonatomic) MoteSelectionMode mode;
@property(nonatomic) NSRect hoveredRect;
@property(nonatomic, readwrite) NSRect selection;
@property(nonatomic) NSPoint downPoint;
@property(nonatomic) NSRect initialSelection;
@property(nonatomic) NSInteger resizeHandle;
@end

static NSRect standardized(NSRect rect) {
  return NSMakeRect(MIN(NSMinX(rect), NSMaxX(rect)), MIN(NSMinY(rect), NSMaxY(rect)), fabs(NSWidth(rect)),
                    fabs(NSHeight(rect)));
}

static NSRect toolbar_rect(NSRect selection, NSRect bounds) {
  CGFloat x = MIN(NSMaxX(bounds) - 124, MAX(8, NSMaxX(selection) - 116));
  CGFloat y = NSMinY(selection) - 46;
  if (y < 8)
    y = MIN(NSMaxY(bounds) - 46, NSMaxY(selection) + 8);
  return NSMakeRect(x, y, 116, 38);
}

@implementation MoteSelectionView
- (BOOL)acceptsFirstResponder {
  return YES;
}
- (BOOL)acceptsFirstMouse:(NSEvent *)event {
  return YES;
}
- (void)updateTrackingAreas {
  [super updateTrackingAreas];
  for (NSTrackingArea *area in self.trackingAreas)
    [self removeTrackingArea:area];
  NSTrackingAreaOptions options =
      NSTrackingMouseMoved | NSTrackingMouseEnteredAndExited | NSTrackingActiveAlways |
      NSTrackingInVisibleRect | NSTrackingEnabledDuringMouseDrag;
  [self addTrackingArea:[[NSTrackingArea alloc] initWithRect:self.bounds options:options owner:self userInfo:nil]];
}
- (NSRect)localRect:(NSRect)screenRect {
  NSRect screen = self.displaySnapshot.screen.frame;
  return NSIntersectionRect(NSOffsetRect(screenRect, -NSMinX(screen), -NSMinY(screen)), self.bounds);
}
- (void)updateHover:(NSPoint)point {
  self.hoveredRect = NSZeroRect;
  NSRect screen = self.displaySnapshot.screen.frame;
  NSPoint screenPoint = NSMakePoint(point.x + NSMinX(screen), point.y + NSMinY(screen));
  for (NSValue *value in self.windowRects) {
    if (NSPointInRect(screenPoint, value.rectValue)) {
      self.hoveredRect = [self localRect:value.rectValue];
      break;
    }
  }
  if (NSIsEmptyRect(self.hoveredRect))
    self.hoveredRect = self.bounds;
}
- (void)resetSelection {
  self.selection = NSZeroRect;
  self.mode = MoteSelectionModeHover;
  [self updateHover:[self convertPoint:self.window.mouseLocationOutsideOfEventStream fromView:nil]];
  [self setNeedsDisplay:YES];
}
- (void)drawSymbol:(NSString *)name inRect:(NSRect)rect {
  NSImage *image = [NSImage imageWithSystemSymbolName:name accessibilityDescription:nil];
  NSImageSymbolConfiguration *config = [NSImageSymbolConfiguration configurationWithPointSize:16
                                                                                       weight:NSFontWeightMedium];
  config = [config configurationByApplyingConfiguration:[NSImageSymbolConfiguration
                                                            configurationWithHierarchicalColor:NSColor.whiteColor]];
  [[image imageWithSymbolConfiguration:config] drawInRect:NSInsetRect(rect, 9, 9)];
}
- (void)drawRect:(NSRect)dirtyRect {
  [self.snapshot drawInRect:self.bounds fromRect:NSZeroRect operation:NSCompositingOperationCopy fraction:1];
  [[NSColor colorWithWhite:0 alpha:.25] setFill];
  // Source-over preserves the frozen desktop; NSRectFill replaces its pixels.
  NSRectFillUsingOperation(self.bounds, NSCompositingOperationSourceOver);
  NSRect focus = NSIsEmptyRect(self.selection) ? self.hoveredRect : self.selection;
  if (!NSIsEmptyRect(focus)) {
    [NSGraphicsContext saveGraphicsState];
    [[NSBezierPath bezierPathWithRect:focus] addClip];
    [self.snapshot drawInRect:self.bounds fromRect:NSZeroRect operation:NSCompositingOperationCopy fraction:1];
    [NSGraphicsContext restoreGraphicsState];
    NSBezierPath *border = [NSBezierPath bezierPathWithRect:NSInsetRect(focus, .5, .5)];
    border.lineWidth = 1.5;
    [NSColor.systemBlueColor setStroke];
    [border stroke];
  }
  if (self.mode >= MoteSelectionModeEditing && !NSIsEmptyRect(self.selection))
    [self drawEditingChrome];
  else
    [self drawLoupe];
}
- (void)drawLoupe {
  NSRect box = NSMakeRect(self.mousePoint.x + 18, self.mousePoint.y - 118, 108, 108);
  if (NSMaxX(box) > NSMaxX(self.bounds))
    box.origin.x = self.mousePoint.x - 126;
  if (NSMinY(box) < 0)
    box.origin.y = self.mousePoint.y + 18;
  box = NSIntersectionRect(box, self.bounds);
  if (NSWidth(box) < 90 || NSHeight(box) < 90)
    return;
  [[NSColor colorWithWhite:.08 alpha:.94] setFill];
  [[NSBezierPath bezierPathWithRoundedRect:box xRadius:7 yRadius:7] fill];
  NSRect imageBox = NSInsetRect(box, 5, 5);
  NSRect source = NSMakeRect(self.mousePoint.x - 7, self.mousePoint.y - 7, 14, 14);
  [self.snapshot drawInRect:imageBox fromRect:source operation:NSCompositingOperationCopy fraction:1];
  [NSColor.whiteColor setStroke];
  NSBezierPath *cross = [NSBezierPath bezierPath];
  [cross moveToPoint:NSMakePoint(NSMidX(imageBox), NSMinY(imageBox))];
  [cross lineToPoint:NSMakePoint(NSMidX(imageBox), NSMaxY(imageBox))];
  [cross moveToPoint:NSMakePoint(NSMinX(imageBox), NSMidY(imageBox))];
  [cross lineToPoint:NSMakePoint(NSMaxX(imageBox), NSMidY(imageBox))];
  cross.lineWidth = .7;
  [cross stroke];
}
- (NSArray<NSValue *> *)handlePoints {
  NSRect r = self.selection;
  return @[
    [NSValue valueWithPoint:NSMakePoint(NSMinX(r), NSMinY(r))],
    [NSValue valueWithPoint:NSMakePoint(NSMidX(r), NSMinY(r))],
    [NSValue valueWithPoint:NSMakePoint(NSMaxX(r), NSMinY(r))],
    [NSValue valueWithPoint:NSMakePoint(NSMaxX(r), NSMidY(r))],
    [NSValue valueWithPoint:NSMakePoint(NSMaxX(r), NSMaxY(r))],
    [NSValue valueWithPoint:NSMakePoint(NSMidX(r), NSMaxY(r))],
    [NSValue valueWithPoint:NSMakePoint(NSMinX(r), NSMaxY(r))],
    [NSValue valueWithPoint:NSMakePoint(NSMinX(r), NSMidY(r))],
  ];
}
- (void)drawEditingChrome {
  [NSColor.whiteColor setFill];
  [NSColor.systemBlueColor setStroke];
  for (NSValue *value in [self handlePoints]) {
    NSPoint point = value.pointValue;
    NSBezierPath *dot = [NSBezierPath bezierPathWithOvalInRect:NSMakeRect(point.x - 3, point.y - 3, 6, 6)];
    [dot fill];
    [dot stroke];
  }
  CGFloat scaleX = (CGFloat)CGImageGetWidth(self.displaySnapshot.image) / NSWidth(self.bounds);
  CGFloat scaleY = (CGFloat)CGImageGetHeight(self.displaySnapshot.image) / NSHeight(self.bounds);
  NSString *size =
      [NSString stringWithFormat:@"%.0f × %.0f", NSWidth(self.selection) * scaleX, NSHeight(self.selection) * scaleY];
  NSDictionary *attrs = @{
    NSFontAttributeName : [NSFont monospacedDigitSystemFontOfSize:11 weight:NSFontWeightMedium],
    NSForegroundColorAttributeName : NSColor.whiteColor
  };
  NSSize textSize = [size sizeWithAttributes:attrs];
  NSRect badge = NSMakeRect(NSMinX(self.selection), NSMaxY(self.selection) + 7, textSize.width + 14, 23);
  if (NSMaxY(badge) > NSMaxY(self.bounds))
    badge.origin.y = NSMaxY(self.bounds) - 27;
  [[NSColor colorWithWhite:.08 alpha:.92] setFill];
  [[NSBezierPath bezierPathWithRoundedRect:badge xRadius:5 yRadius:5] fill];
  [size drawAtPoint:NSMakePoint(NSMinX(badge) + 7, NSMinY(badge) + 5) withAttributes:attrs];
  NSRect toolbar = toolbar_rect(self.selection, self.bounds);
  [[NSColor colorWithWhite:.08 alpha:.94] setFill];
  [[NSBezierPath bezierPathWithRoundedRect:toolbar xRadius:9 yRadius:9] fill];
  [self drawSymbol:@"arrow.counterclockwise" inRect:NSMakeRect(NSMinX(toolbar), NSMinY(toolbar), 38, 38)];
  [self drawSymbol:@"xmark" inRect:NSMakeRect(NSMinX(toolbar) + 39, NSMinY(toolbar), 38, 38)];
  [[NSColor colorWithSRGBRed:.04 green:.52 blue:1 alpha:1] setFill];
  [[NSBezierPath bezierPathWithRoundedRect:NSMakeRect(NSMinX(toolbar) + 78, NSMinY(toolbar) + 2, 36, 34)
                                   xRadius:7
                                   yRadius:7] fill];
  [self drawSymbol:@"checkmark" inRect:NSMakeRect(NSMinX(toolbar) + 77, NSMinY(toolbar), 38, 38)];
}
- (NSInteger)handleAtPoint:(NSPoint)point {
  NSInteger index = 0;
  for (NSValue *value in [self handlePoints]) {
    NSPoint handle = value.pointValue;
    if (hypot(point.x - handle.x, point.y - handle.y) <= 8)
      return index;
    index++;
  }
  return -1;
}
- (void)mouseMoved:(NSEvent *)event {
  self.mousePoint = [self convertPoint:event.locationInWindow fromView:nil];
  if (self.mode == MoteSelectionModeHover)
    [self updateHover:self.mousePoint];
  [self setNeedsDisplay:YES];
}
- (void)mouseEntered:(NSEvent *)event { [self mouseMoved:event]; }
- (void)mouseExited:(NSEvent *)event {
  self.hoveredRect = NSZeroRect;
  [self setNeedsDisplay:YES];
}
- (void)mouseDown:(NSEvent *)event {
  NSPoint point = [self convertPoint:event.locationInWindow fromView:nil];
  self.mousePoint = point;
  [self updateHover:point];
  if (event.clickCount >= 2 && self.mode >= MoteSelectionModeEditing && NSPointInRect(point, self.selection)) {
    [self.delegate acceptView:self];
    return;
  }
  self.downPoint = point;
  self.initialSelection = self.selection;
  if (self.mode >= MoteSelectionModeEditing) {
    NSRect toolbar = toolbar_rect(self.selection, self.bounds);
    if (NSPointInRect(point, NSMakeRect(NSMinX(toolbar), NSMinY(toolbar), 38, 38))) {
      [self resetSelection];
      return;
    }
    if (NSPointInRect(point, NSMakeRect(NSMinX(toolbar) + 39, NSMinY(toolbar), 38, 38))) {
      [self.delegate cancel];
      return;
    }
    if (NSPointInRect(point, NSMakeRect(NSMinX(toolbar) + 77, NSMinY(toolbar), 39, 38))) {
      [self.delegate acceptView:self];
      return;
    }
    self.resizeHandle = [self handleAtPoint:point];
    if (self.resizeHandle >= 0)
      self.mode = MoteSelectionModeResizing;
    else if (NSPointInRect(point, self.selection))
      self.mode = MoteSelectionModeMoving;
    else {
      [self updateHover:point];
      self.selection = NSZeroRect;
      self.mode = MoteSelectionModeDrawing;
    }
  } else {
    self.mode = MoteSelectionModeDrawing;
    self.selection = self.hoveredRect;
  }
  [self.delegate selectView:self];
  [self.window makeKeyWindow];
  [self.window makeFirstResponder:self];
  [self setNeedsDisplay:YES];
}
- (void)mouseDragged:(NSEvent *)event {
  NSPoint point = [self convertPoint:event.locationInWindow fromView:nil];
  if (self.mode == MoteSelectionModeDrawing) {
    NSRect raw = NSMakeRect(self.downPoint.x, self.downPoint.y, point.x - self.downPoint.x, point.y - self.downPoint.y);
    self.selection = NSIntersectionRect(standardized(raw), self.bounds);
  } else if (self.mode == MoteSelectionModeMoving) {
    NSRect moved = NSOffsetRect(self.initialSelection, point.x - self.downPoint.x, point.y - self.downPoint.y);
    moved.origin.x = MIN(MAX(0, moved.origin.x), NSWidth(self.bounds) - NSWidth(moved));
    moved.origin.y = MIN(MAX(0, moved.origin.y), NSHeight(self.bounds) - NSHeight(moved));
    self.selection = moved;
  } else if (self.mode == MoteSelectionModeResizing)
    [self resizeToPoint:point];
  [self setNeedsDisplay:YES];
}
- (void)resizeToPoint:(NSPoint)point {
  NSRect r = self.initialSelection;
  CGFloat left = NSMinX(r), right = NSMaxX(r), bottom = NSMinY(r), top = NSMaxY(r);
  if (self.resizeHandle == 0 || self.resizeHandle == 6 || self.resizeHandle == 7)
    left = point.x;
  if (self.resizeHandle == 2 || self.resizeHandle == 3 || self.resizeHandle == 4)
    right = point.x;
  if (self.resizeHandle <= 2)
    bottom = point.y;
  if (self.resizeHandle >= 4 && self.resizeHandle <= 6)
    top = point.y;
  self.selection = NSIntersectionRect(standardized(NSMakeRect(left, bottom, right - left, top - bottom)), self.bounds);
}
- (void)mouseUp:(NSEvent *)event {
  if (self.mode == MoteSelectionModeDrawing) {
    NSPoint point = [self convertPoint:event.locationInWindow fromView:nil];
    if (hypot(point.x - self.downPoint.x, point.y - self.downPoint.y) < 4)
      self.selection = self.hoveredRect;
  }
  if (!NSIsEmptyRect(self.selection))
    self.mode = MoteSelectionModeEditing;
  [self setNeedsDisplay:YES];
}
- (void)keyDown:(NSEvent *)event {
  if (event.keyCode == 53)
    [self.delegate cancel];
  else if ((event.keyCode == 36 || event.keyCode == 76) && self.mode >= MoteSelectionModeEditing)
    [self.delegate acceptView:self];
  else
    [super keyDown:event];
}
- (void)resetCursorRects {
  [self addCursorRect:self.bounds cursor:NSCursor.crosshairCursor];
}
@end
