// Copyright © 2017 DWANGO Co., Ltd.

#import "CBBObjectChannel.h"

NS_ASSUME_NONNULL_BEGIN

@interface CBBDirectObjectChannel : CBBObjectChannel
- (instancetype)initWithFunctionChannel:(CBBFunctionChannel*)functionChannel objectSpace:(nullable CBBObjectSpace*)objectSpace UNAVAILABLE_ATTRIBUTE;
- (instancetype)initWithFunctionChannel:(CBBFunctionChannel*)functionChannel UNAVAILABLE_ATTRIBUTE;
- (instancetype)initWithDataBus:(CBBDataBus*)dataBus objectSpace:(nullable CBBObjectSpace*)objectSpace;
- (instancetype)initWithDataBus:(CBBDataBus*)dataBus;
@end

NS_ASSUME_NONNULL_END
