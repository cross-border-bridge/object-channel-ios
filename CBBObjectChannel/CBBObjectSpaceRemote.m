// Copyright © 2017 DWANGO Co., Ltd.

#import "CBBObjectSpaceRemote.h"

NS_ASSUME_NONNULL_BEGIN

@interface CBBObjectSpaceRemote ()
@property (nonatomic) CBBFunctionChannel* functionChannel;
@property (nonatomic) CBBObjectSpace* objectSpace;
@end

@implementation CBBObjectSpaceRemote

- (instancetype)initWithFunctionChannel:(CBBFunctionChannel*)functionChannel objectSpace:(CBBObjectSpace*)objectSpace
{
    if (self = [super init]) {
        _functionChannel = functionChannel;
        _objectSpace = objectSpace;
    }
    return self;
}

- (NSString*)createInstanceWithClassName:(NSString*)className arguments:(nullable NSArray*)arguments
{
    id instance = [self.objectSpace createInstanceWithClassName:className arguments:arguments];
    NSNumber* index = [self.objectSpace registerWithInstance:instance className:className];
    NSString* instanceId = [NSString stringWithFormat:@"%@:%@", className, index];
    [self.functionChannel bindWithInstanceId:instanceId instance:instance];
    return instanceId;
}

- (void)destroyInstanceWithInstanceId:(NSString*)instanceId
{
    NSArray* instaceInfo = [instanceId componentsSeparatedByString:@":"];
    [self.objectSpace destroyInstanceWithClassName:instaceInfo[0] index:instaceInfo[1]];
}

@end

NS_ASSUME_NONNULL_END
