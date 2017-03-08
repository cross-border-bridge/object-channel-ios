// Copyright © 2017 DWANGO Co., Ltd.

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface CBBObjectSpace : NSObject
+ (instancetype)sharedInstance;
- (void)bindClass:(Class)clazz;
- (void)bindClassWithClassName:(NSString*)className;
- (id)createInstanceWithClassName:(NSString*)className arguments:(nullable NSArray*)arguments;
- (NSNumber*)registerWithInstance:(id)instance className:(NSString*)className;
- (void)destroyInstanceWithClassName:(NSString*)className index:(NSNumber*)instanceId;
@end

NS_ASSUME_NONNULL_END
