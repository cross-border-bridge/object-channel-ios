// Copyright © 2017 DWANGO Co., Ltd.

#import "CBBMemoryQueueDataBus.h"
#import "CBBObjectChannel.h"
#import "MyClassObjc.h"
#import <XCTest/XCTest.h>

extern int MyClassObjcDestroyCounter;

@interface CBBObjectChannelTests : XCTestCase
@property (readwrite) CBBObjectChannel* objChA;
@property (readwrite) CBBObjectChannel* objChB;
@property (readwrite) CBBRemoteObject* objA;
@property (readwrite) CBBRemoteObject* objB;
@property (readwrite) NSInteger counter;
@end

@implementation CBBObjectChannelTests

- (void)setUp
{
    [super setUp];
    CBBMemoryQueue* mqA = [[CBBMemoryQueue alloc] init];
    CBBMemoryQueue* mqB = [[CBBMemoryQueue alloc] init];
    CBBDataBus* dataBusA = [[CBBMemoryQueueDataBus alloc] initWithSender:mqA receiver:mqB];
    CBBDataBus* dataBusB = [[CBBMemoryQueueDataBus alloc] initWithSender:mqB receiver:mqA];
    CBBDataChannel* dataChA = [[CBBDataChannel alloc] initWithDataBus:dataBusA];
    CBBDataChannel* dataChB = [[CBBDataChannel alloc] initWithDataBus:dataBusB];
    CBBFunctionChannel* funcChA = [[CBBFunctionChannel alloc] initWithDataChannel:dataChA];
    CBBFunctionChannel* funcChB = [[CBBFunctionChannel alloc] initWithDataChannel:dataChB];
    _objChA = [[CBBObjectChannel alloc] initWithFunctionChannel:funcChA];
    _objChB = [[CBBObjectChannel alloc] initWithFunctionChannel:funcChB];
}

- (void)tearDown
{
    [super tearDown];
}

- (void)testObjectChannel1
{
    NSLog(@"[正常系] A/B共有の空間にMyClassObjcをbind");
    [[CBBObjectSpace sharedInstance] bindClass:[MyClassObjc class]];

    NSLog(@"[正常系] _objChAを用いてBのMyClassObjインスタンス(_objB)を生成");
    [_objChA createRemoteObjectWithClassName:@"MyClassObjc"
                                   arguments:nil
                                    callback:^(CBBRemoteObject* _Nullable remoteObject) {
                                        XCTAssertNotNil(remoteObject);
                                        _objB = remoteObject;
                                    }];
    XCTAssertNotNil(_objB);

    NSLog(@"[正常系] _objBのメソッドfooを実行");
    _counter = 0;
    [_objB invokeWithMethod:@"fooWithABC"
                  arguments:@[ @"One", @(2), @"3" ]
                   callback:^(NSError* _Nullable error, id _Nullable result) {
                       XCTAssertNil(error);
                       XCTAssertNotNil(result);
                       NSString* resultString = result;
                       NSLog(@"resultString: %@", resultString);
                       XCTAssertTrue([resultString isEqualToString:@"One+2+3"]);
                       _counter++;
                   }];
    XCTAssertEqual(_counter, 1);

    NSLog(@"[異常系] 存在しないメソッドを実行");
    _counter = 0;
    [_objB invokeWithMethod:@"fooWithABCD"
                  arguments:@[ @"One", @(2), @"3" ]
                   callback:^(NSError* _Nullable error, id _Nullable result) {
                       XCTAssertNotNil(error);
                       NSLog(@"error: %@", error);
                       _counter++;
                   }];
    XCTAssertEqual(_counter, 1);

    NSLog(@"[正常系] _objBを破棄");
    MyClassObjcDestroyCounter = 0;
    [_objB destroy];
    XCTAssertEqual(MyClassObjcDestroyCounter, 1);

    NSLog(@"[異常系] 破棄したオブジェクトのメソッドを実行");
    _counter = 0;
    [_objB invokeWithMethod:@"fooWithABC"
                  arguments:@[ @"One", @(2), @"3" ]
                   callback:^(NSError* _Nullable error, id _Nullable result) {
                       XCTAssertNotNil(error);
                       NSLog(@"error: %@", error);
                       _counter++;
                   }];
    XCTAssertEqual(_counter, 1);

    NSLog(@"[異常系] _objBを多重破棄（デストラクタは多重実行されないことの検証 #1）");
    MyClassObjcDestroyCounter = 0;
    [_objB destroy];
    XCTAssertEqual(MyClassObjcDestroyCounter, 0);

    NSLog(@"[正常系] _objBの参照を解除（デストラクタは多重実行されないことの検証 #2）");
    MyClassObjcDestroyCounter = 0;
    _objB = nil;
    XCTAssertEqual(MyClassObjcDestroyCounter, 0);
}

@end
