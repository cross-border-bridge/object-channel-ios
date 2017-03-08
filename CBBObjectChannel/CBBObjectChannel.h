// Copyright © 2017 DWANGO Co., Ltd.

#import "CBBObjectSpace.h"
#import "CBBRemoteObject.h"
#import <CBBFunctionChannel/CBBFunctionChannel.h>
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef void (^CBBRemoteObjectConstructHandler)(CBBRemoteObject* _Nullable remoteObject);

@interface CBBObjectChannel : NSObject
- (instancetype)init UNAVAILABLE_ATTRIBUTE;
@property (readonly) BOOL destroyed;
- (instancetype)initWithFunctionChannel:(CBBFunctionChannel*)functionChannel objectSpace:(nullable CBBObjectSpace*)objectSpace NS_DESIGNATED_INITIALIZER;
- (instancetype)initWithFunctionChannel:(CBBFunctionChannel*)functionChannel;
- (void)bindClass:(Class)clazz;
- (void)bindWithClassName:(NSString*)className;
- (void)createRemoteObjectWithClassName:(NSString*)className arguments:(nullable NSArray*)arguments callback:(CBBRemoteObjectConstructHandler)handler;
- (void)destroy;
@end

NS_ASSUME_NONNULL_END
