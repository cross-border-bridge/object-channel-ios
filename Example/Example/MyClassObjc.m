// Copyright © 2017 DWANGO Co., Ltd.

#import "MyClassObjc.h"

@interface MyClassObjc ()
@property (readwrite) BOOL destroyed;
@end

@implementation MyClassObjc

- (NSString*)foo:(id)arg1:(id)arg2:(id)arg3
{
    return [[NSString alloc] initWithFormat:@"%@+%@+%@", arg1, arg2, arg3];
}

- (CBBAsyncResult*)fooA:(id)arg1:(id)arg2:(id)arg3
{
    return [CBBAsyncResult create:^(void (^_Nonnull done)(id _Nonnull)) {
        usleep(3000 * 1000);
        done([[NSString alloc] initWithFormat:@"%@+%@+%@", arg1, arg2, arg3]);
    }];
}

- (void)destroy
{
    NSLog(@"execute destructor");
    _destroyed = YES;
}

@end
