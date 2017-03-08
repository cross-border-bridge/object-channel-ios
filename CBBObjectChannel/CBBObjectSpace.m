// Copyright © 2017 DWANGO Co., Ltd.

#import "CBBObjectSpace.h"
#import <CBBFunctionChannel/CBBRemoteExportUtility.h>

NS_ASSUME_NONNULL_BEGIN

typedef _Nonnull id (^CBBObjectSpaceConstructHandler)(NSArray* _Nullable arguments);

@interface CBBObjectSpace ()
@property (nonatomic) NSMutableDictionary<NSString*, CBBObjectSpaceConstructHandler>* constructorTable;
@property (nonatomic) NSMutableDictionary<NSString*, NSMutableDictionary<NSNumber*, id>*>* instanceTable;
@property (nonatomic) NSMutableDictionary<NSString*, NSNumber*>* indexCounters;
@end

@implementation CBBObjectSpace

- (instancetype)init
{
    if (self = [super init]) {
        _constructorTable = [NSMutableDictionary dictionary];
        _instanceTable = [NSMutableDictionary dictionary];
        _indexCounters = [NSMutableDictionary dictionary];
    }
    return self;
}

+ (instancetype)sharedInstance
{
    static dispatch_once_t onceToken;
    static id instance;
    dispatch_once(&onceToken, ^{
        instance = [[self alloc] init];
    });
    return instance;
}

- (void)bindClass:(Class)clazz
{
    NSString* className = NSStringFromClass(clazz);
    NSDictionary* methodTable = [CBBRemoteExportUtility exportRemoteExportMethodTableFromClass:clazz];
    // initializersを収集
    NSMutableSet<NSString*>* initializerCandidates = [NSMutableSet new];
    for (NSString* methodName in methodTable.objectEnumerator.allObjects) {
        if ([methodName hasPrefix:@"init"]) {
            [initializerCandidates addObject:methodName];
        }
    }
    // initializersを登録
    NSMutableDictionary<NSNumber*, NSString*>* initializerTable = [[NSMutableDictionary alloc] initWithCapacity:1];
    for (NSString* candiate in initializerCandidates) {
        NSNumber* index = @([candiate componentsSeparatedByString:@":"].count - 1);
        if (!initializerTable[index]) {
            initializerTable[index] = candiate;
        } else {
            NSLog(@"CBBJSExport protocol constructor error. Class name: [%@]", className);
        }
    }
    // 初期化ハンドラーを登録
    self.constructorTable[className] = ^id(NSArray* _Nullable arguments) {
        id instance = nil;
        if (arguments.count != 0) {
            NSString* initializer = initializerTable[@(arguments.count)];
            if (!initializer) {
                NSLog(@"CBBJSExport protocol constructor error. Arguments: %@", arguments);
            } else {
                SEL initializerSEL = NSSelectorFromString(initializer);
                instance = [clazz alloc];
                NSMethodSignature* methodSignature = [instance methodSignatureForSelector:initializerSEL];
                NSInvocation* invocation = [NSInvocation invocationWithMethodSignature:methodSignature];
                invocation.selector = initializerSEL;
                invocation.target = instance;
                NSInteger index = 2;
                for (id argument in arguments) {
                    [invocation setArgument:(void*)&argument atIndex:index++];
                }
                [invocation retainArguments];
                [invocation invoke];
            }
        } else {
            instance = [clazz new];
        }
        return instance;
    };
}

- (void)bindClassWithClassName:(NSString*)className
{
    [self bindClass:NSClassFromString(className)];
}

- (id)createInstanceWithClassName:(NSString*)className arguments:(nullable NSArray*)arguments
{
    id instance = nil;
    if (self.constructorTable[className]) {
        instance = self.constructorTable[className](arguments);
    }
    return instance;
}

- (NSNumber*)registerWithInstance:(id)instance className:(NSString*)className
{
    if (!self.instanceTable[className]) {
        self.instanceTable[className] = [NSMutableDictionary dictionary];
    }
    if (!self.indexCounters[className]) {
        self.indexCounters[className] = @0;
    }
    NSNumber* index = @(self.indexCounters[className].integerValue + 1);
    self.instanceTable[className][index] = instance;
    return index;
}

- (void)destroyInstanceWithClassName:(NSString*)className index:(NSNumber*)index
{
    id instance = self.instanceTable[className][@([index integerValue])];
    if (!instance) {
        return;
    }
    // destroyメソッドがあればinvokeしておく
    SEL selector = NSSelectorFromString(@"destroy");
    NSMethodSignature* methodSignature = [instance methodSignatureForSelector:selector];
    if (methodSignature) {
        NSInvocation* invocation = [NSInvocation invocationWithMethodSignature:methodSignature];
        NSLog(@"invocation: %@, numberOfArguments: %ld", invocation, methodSignature.numberOfArguments);
        if (invocation && 2 == methodSignature.numberOfArguments) {
            invocation.selector = selector;
            invocation.target = instance;
            [invocation invoke];
        } else {
            NSLog(@"warning: invalid destroy method argument in %@", className);
        }
    } else {
        NSLog(@"warning: destroy method has not declared in %@", className);
    }
    // 参照を解除
    self.instanceTable[className][index] = nil;
}

@end

NS_ASSUME_NONNULL_END
