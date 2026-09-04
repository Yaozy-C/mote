#import "MoteScreenshotSupport.h"
#import "MoteScreenshotView.h"

@interface MoteCapturePanel : NSPanel
@end
@implementation MoteCapturePanel
- (BOOL)canBecomeKeyWindow {
  return YES;
}
@end

@interface MoteCaptureSession : NSObject <MoteSelectionViewDelegate>
@property(nonatomic, strong) NSMutableArray<MoteCapturePanel *> *panels;
@property(nonatomic, strong) MoteSelectionView *selectedView;
@property(nonatomic) BOOL finished;
@property(nonatomic) BOOL accepted;
@end

@implementation MoteCaptureSession
- (instancetype)init {
  if ((self = [super init]))
    _panels = [NSMutableArray array];
  return self;
}
- (void)selectView:(MoteSelectionView *)view {
  for (MoteCapturePanel *panel in self.panels) {
    MoteSelectionView *other = (MoteSelectionView *)panel.contentView;
    if (other != view)
      [other resetSelection];
  }
  self.selectedView = view;
}
- (void)acceptView:(MoteSelectionView *)view {
  if (NSWidth(view.selection) < 2 || NSHeight(view.selection) < 2)
    return;
  self.selectedView = view;
  self.accepted = YES;
  self.finished = YES;
}
- (void)cancel {
  self.finished = YES;
}
@end

static MoteCapturePanel *create_panel(MoteDisplaySnapshot *snapshot, NSArray<NSValue *> *windows,
                                      MoteCaptureSession *session, NSPoint mouse) {
  NSRect frame = snapshot.screen.frame;
  MoteCapturePanel *panel = [[MoteCapturePanel alloc] initWithContentRect:frame
                                                                styleMask:NSWindowStyleMaskBorderless
                                                                  backing:NSBackingStoreBuffered
                                                                    defer:NO];
  panel.level = NSScreenSaverWindowLevel;
  panel.opaque = YES;
  panel.backgroundColor = NSColor.blackColor;
  panel.acceptsMouseMovedEvents = YES;
  panel.releasedWhenClosed = NO;
  panel.collectionBehavior = NSWindowCollectionBehaviorCanJoinAllSpaces |
                             NSWindowCollectionBehaviorFullScreenAuxiliary | NSWindowCollectionBehaviorStationary;

  MoteSelectionView *view = [[MoteSelectionView alloc] initWithFrame:NSMakeRect(0, 0, NSWidth(frame), NSHeight(frame))];
  view.delegate = session;
  view.displaySnapshot = snapshot;
  view.snapshot = [[NSImage alloc] initWithCGImage:snapshot.image size:frame.size];
  view.windowRects = windows;
  view.mousePoint = NSPointInRect(mouse, frame) ? NSMakePoint(mouse.x - NSMinX(frame), mouse.y - NSMinY(frame))
                                                : NSMakePoint(NSMidX(view.bounds), NSMidY(view.bounds));
  [view updateHover:view.mousePoint];
  panel.contentView = view;
  return panel;
}

static int run_selector(const char *outputPath, char *error, size_t errorLength) {
  NSError *captureError = nil;
  NSArray<MoteDisplaySnapshot *> *snapshots = MoteCaptureDisplaySnapshots(&captureError);
  if (snapshots.count == 0) {
    MoteSelectorError(error, errorLength, captureError.localizedDescription ?: @"Screen Recording access is required.");
    return 3;
  }
  NSArray<NSValue *> *windows = MoteCandidateWindowRects();
  MoteCaptureSession *session = [MoteCaptureSession new];
  NSPoint mouse = NSEvent.mouseLocation;
  MoteCapturePanel *keyPanel = nil;
  for (MoteDisplaySnapshot *snapshot in snapshots) {
    MoteCapturePanel *panel = create_panel(snapshot, windows, session, mouse);
    [session.panels addObject:panel];
    if (NSPointInRect(mouse, snapshot.screen.frame))
      keyPanel = panel;
  }
  [NSApp activateIgnoringOtherApps:YES];
  for (MoteCapturePanel *panel in session.panels)
    [panel orderFrontRegardless];
  keyPanel = keyPanel ?: session.panels.firstObject;
  [keyPanel makeKeyWindow];
  [keyPanel makeFirstResponder:keyPanel.contentView];
  while (!session.finished) {
    @autoreleasepool {
      NSEvent *event = [NSApp nextEventMatchingMask:NSEventMaskAny
                                          untilDate:[NSDate dateWithTimeIntervalSinceNow:.05]
                                             inMode:NSDefaultRunLoopMode
                                            dequeue:YES];
      if (event)
        [NSApp sendEvent:event];
    }
  }
  for (MoteCapturePanel *panel in session.panels)
    [panel orderOut:nil];
  if (!session.accepted)
    return 1;
  return MoteWriteDisplaySelection(session.selectedView.displaySnapshot, session.selectedView.selection, outputPath,
                                   error, errorLength)
             ? 0
             : 5;
}

int mote_select_screenshot(const char *outputPath, char *error, size_t errorLength) {
  @autoreleasepool {
    __block int status = 0;
    void (^work)(void) = ^{
      status = run_selector(outputPath, error, errorLength);
    };
    if (NSThread.isMainThread)
      work();
    else
      dispatch_sync(dispatch_get_main_queue(), work);
    return status;
  }
}
