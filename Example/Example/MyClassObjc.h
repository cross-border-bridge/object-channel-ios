// Copyright © 2017 DWANGO Co., Ltd.

#import <CBBFunctionChannel/CBBAsyncResult.h>
#import <CBBFunctionChannel/CBBRemoteExport.h>
#import <Foundation/Foundation.h>

@protocol MyClassObjcExport <CBBRemoteExport>
- (NSString*)foo:(id)arg1:(id)arg2:(id)arg3;
- (CBBAsyncResult*)fooA:(id)arg1:(id)arg2:(id)arg3;
@end

@interface MyClassObjc : NSObject <MyClassObjcExport>
@end
