// Copyright © 2017 DWANGO Co., Ltd.

#import "CBBObjectSpace.h"
#import <CBBFunctionChannel/CBBFunctionChannel.h>
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@protocol CBBObjectSpaceRemoteExport <CBBRemoteExport>
CBBRemoteExportAs(create,
                  -(NSString*)createInstanceWithClassName
                  : (NSString*)className arguments
                  : (nullable NSArray*)arguments);
CBBRemoteExportAs(destroy,
                  -(void)destroyInstanceWithInstanceId
                  : (NSString*)instanceId);
@end

@interface CBBObjectSpaceRemote : NSObject <CBBObjectSpaceRemoteExport>
- (instancetype)init UNAVAILABLE_ATTRIBUTE;

- (instancetype)initWithFunctionChannel:(CBBFunctionChannel*)functionChannel objectSpace:(CBBObjectSpace*)objectSpace NS_DESIGNATED_INITIALIZER;
@end

NS_ASSUME_NONNULL_END
