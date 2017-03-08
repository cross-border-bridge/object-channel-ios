// Copyright © 2017 DWANGO Co., Ltd.

#import "CBBDirectObjectChannel.h"

@interface CBBDirectObjectChannel ()
@property (atomic) CBBDataChannel* dataChannel;
@property (atomic) CBBFunctionChannel* functionChannel;
@end

@implementation CBBDirectObjectChannel

- (instancetype)initWithDataBus:(CBBDataBus*)dataBus objectSpace:(nullable CBBObjectSpace*)objectSpace
{
    CBBDataChannel* dataChannel = [[CBBDataChannel alloc] initWithDataBus:dataBus];
    CBBFunctionChannel* functionChannel = [[CBBFunctionChannel alloc] initWithDataChannel:dataChannel];
    if (self = [super initWithFunctionChannel:functionChannel objectSpace:objectSpace]) {
        _dataChannel = dataChannel;
        _functionChannel = functionChannel;
    }
    return self;
}

- (instancetype)initWithDataBus:(CBBDataBus*)dataBus;
{
    return [self initWithDataBus:dataBus objectSpace:nil];
}

- (void)destroy
{
    [super destroy];
    [_functionChannel destroy];
    [_dataChannel destroy];
}

@end
