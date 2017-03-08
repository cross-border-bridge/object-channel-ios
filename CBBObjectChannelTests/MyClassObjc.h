// Copyright © 2017 DWANGO Co., Ltd.

#import "CBBObjectChannel.h"
#import <Foundation/Foundation.h>

@protocol MyClassObjcExport <CBBRemoteExport>
- (NSString*)fooWithA:(id)arg1 b:(id)arg2 c:(id)arg3;
@end

@interface MyClassObjc : NSObject <MyClassObjcExport>
@end
