// Copyright © 2017 DWANGO Co., Ltd.

#import "CBBRemoteObject.h"

NS_ASSUME_NONNULL_BEGIN

@interface CBBRemoteObject ()
@property (nonatomic) CBBFunctionChannel* functionChannel;
@property (nonatomic) NSString* instanceId;
@property (nonatomic) BOOL destroyed;
@end

@implementation CBBRemoteObject

- (instancetype)initWithFunctionChannel:(CBBFunctionChannel*)functionChannel instanceId:(NSString*)instanceId
{
    if (self = [super init]) {
        _functionChannel = functionChannel;
        _instanceId = instanceId;
    }
    return self;
}

- (void)invokeWithMethod:(NSString*)methodName
               arguments:(nullable NSArray*)arguments
                callback:(nullable CBBFunctionChannelCallback)callback
{
    if (_destroyed) {
        callback([NSError errorWithDomain:@"RemoteObjectDestroyed" code:-1 userInfo:nil], nil);
        return;
    }
    [self.functionChannel invokeWithInstanceId:self.instanceId method:methodName arguments:arguments callback:callback];
}

- (void)invokeWithMethod:(NSString*)methodName
               arguments:(nullable NSArray*)arguments
                 timeout:(NSTimeInterval)timeout
                callback:(nullable CBBFunctionChannelCallback)callback
{
    if (_destroyed) {
        callback([NSError errorWithDomain:@"RemoteObjectDestroyed" code:-1 userInfo:nil], nil);
        return;
    }
    [self.functionChannel invokeWithInstanceId:self.instanceId method:methodName arguments:arguments timeout:timeout callback:callback];
}

- (void)destroy
{
    if (!_destroyed) {
        _destroyed = YES;
        [self.functionChannel invokeWithInstanceId:@"$obj" method:@"destroy" arguments:@[ self.instanceId ] callback:nil];
    }
}

- (void)dealloc
{
    [self destroy];
}

@end

NS_ASSUME_NONNULL_END
