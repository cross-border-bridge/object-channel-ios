// Copyright © 2017 DWANGO Co., Ltd.

#import "CBBObjectChannel.h"
#import "CBBObjectSpaceRemote.h"
#import "CBBRemoteObject.h"

NS_ASSUME_NONNULL_BEGIN

@interface CBBObjectChannel ()
@property (readwrite) BOOL destroyed;
@property (nonatomic) CBBFunctionChannel* functionChannel;
@property (nonatomic) CBBObjectSpace* objectSpace;
@property (nonatomic) CBBObjectSpaceRemote* objectSpaceRemote;
@end

@implementation CBBObjectChannel

- (instancetype)initWithFunctionChannel:(CBBFunctionChannel*)functionChannel objectSpace:(nullable CBBObjectSpace*)objectSpace
{
    if (self = [super init]) {
        _functionChannel = functionChannel;
        _objectSpace = objectSpace ?: [CBBObjectSpace sharedInstance];
        _objectSpaceRemote = [[CBBObjectSpaceRemote alloc] initWithFunctionChannel:_functionChannel objectSpace:_objectSpace];
        [_functionChannel bindWithInstanceId:@"$obj" instance:_objectSpaceRemote];
    }
    return self;
}

- (instancetype)initWithFunctionChannel:(CBBFunctionChannel*)functionChannel
{
    return [self initWithFunctionChannel:functionChannel objectSpace:nil];
}

- (void)bindClass:(Class)clazz
{
    if (_destroyed) {
        return;
    }
    [self.objectSpace bindClass:clazz];
}

- (void)bindWithClassName:(NSString*)className
{
    if (_destroyed) {
        return;
    }
    [self.objectSpace bindClassWithClassName:className];
}

- (void)createRemoteObjectWithClassName:(NSString*)className arguments:(nullable NSArray*)arguments callback:(CBBRemoteObjectConstructHandler)handler
{
    if (_destroyed) {
        return;
    }
    NSArray* fcArguments = @[ className, arguments ?: @[] ];
    [self.functionChannel invokeWithInstanceId:@"$obj"
                                        method:@"create"
                                     arguments:fcArguments
                                      callback:^(NSError* _Nullable error, id _Nullable result) {
                                          if (error) {
                                              handler(nil);
                                          } else {
                                              CBBRemoteObject* remoteObject = [[CBBRemoteObject alloc] initWithFunctionChannel:self.functionChannel instanceId:result];
                                              handler(remoteObject);
                                          }
                                      }];
}

- (void)destroy
{
    if (_destroyed) {
        return;
    }
    [_functionChannel unbindWithInstanceId:@"$obj"];
    _functionChannel = nil;
    _objectSpace = nil;
    _objectSpaceRemote = nil;
    _destroyed = YES;
}

- (void)dealloc
{
    [self destroy];
}

@end

NS_ASSUME_NONNULL_END
