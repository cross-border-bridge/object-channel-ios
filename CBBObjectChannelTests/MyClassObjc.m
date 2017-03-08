// Copyright © 2017 DWANGO Co., Ltd.

#import "MyClassObjc.h"

int MyClassObjcDestroyCounter = 0;

@implementation MyClassObjc

- (NSString*)fooWithA:(id)arg1 b:(id)arg2 c:(id)arg3
{
    return [[NSString alloc] initWithFormat:@"%@+%@+%@", arg1, arg2, arg3];
}

- (void)destroy
{
    NSLog(@"Execute destructor");
    MyClassObjcDestroyCounter++;
}

@end
