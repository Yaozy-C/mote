#import "MoteScreenshotSupport.h"

@class MoteSelectionView;

@protocol MoteSelectionViewDelegate <NSObject>
- (void)selectView:(MoteSelectionView *)view;
- (void)acceptView:(MoteSelectionView *)view;
- (void)cancel;
@end

@interface MoteSelectionView : NSView
@property(nonatomic, weak) id<MoteSelectionViewDelegate> delegate;
@property(nonatomic, strong) MoteDisplaySnapshot *displaySnapshot;
@property(nonatomic, strong) NSImage *snapshot;
@property(nonatomic, strong) NSArray<NSValue *> *windowRects;
@property(nonatomic, readonly) NSRect selection;
@property(nonatomic) NSPoint mousePoint;
- (void)updateHover:(NSPoint)point;
- (void)resetSelection;
@end
