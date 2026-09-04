#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>

@interface MoteDisplaySnapshot : NSObject
@property(nonatomic, strong) NSScreen *screen;
@property(nonatomic) CGImageRef image;
@end

NSArray<MoteDisplaySnapshot *> *MoteCaptureDisplaySnapshots(NSError **error);
NSArray<NSValue *> *MoteCandidateWindowRects(void);
BOOL MoteWriteDisplaySelection(MoteDisplaySnapshot *snapshot, NSRect localSelection, const char *path, char *error,
                               size_t errorLength);
void MoteSelectorError(char *buffer, size_t length, NSString *message);
