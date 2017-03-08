// Copyright © 2017 DWANGO Co., Ltd.

#import <CBBFunctionChannel/CBBFunctionChannel.h>
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface CBBRemoteObject : NSObject
- (instancetype)init UNAVAILABLE_ATTRIBUTE;

- (instancetype)initWithFunctionChannel:(CBBFunctionChannel*)functionChannel instanceId:(NSString*)instanceId NS_DESIGNATED_INITIALIZER;
- (void)invokeWithMethod:(NSString*)methodName
               arguments:(nullable NSArray*)arguments
                callback:(nullable CBBFunctionChannelCallback)callback;
- (void)invokeWithMethod:(NSString*)methodName
               arguments:(nullable NSArray*)arguments
                 timeout:(NSTimeInterval)timeout
                callback:(nullable CBBFunctionChannelCallback)callback;
- (void)destroy;
@end

NS_ASSUME_NONNULL_END
