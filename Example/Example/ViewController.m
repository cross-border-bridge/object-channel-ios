// Copyright © 2017 DWANGO Co., Ltd.

#import "MyClassObjc.h"
#import "ViewController.h"
#import <CBBDataBus/CBBWKWebViewDataBus.h>
#import <CBBObjectChannel/CBBDirectObjectChannel.h>
#import <WebKit/WebKit.h>

@interface ViewController () <WKNavigationDelegate, WKUIDelegate>
@property (nonatomic) WKWebView* webView;
@property (nonatomic) CBBDataBus* dataBus;
@property (nonatomic) CBBDirectObjectChannel* objectChannel;
@property (nonatomic) CBBRemoteObject* remoteObject;
@property (nonatomic) NSMutableArray* handlerIds;
@end

@implementation ViewController

- (void)viewDidLoad
{
    [super viewDidLoad];
    _handlerIds = [[NSMutableArray alloc] init];
    CGFloat width = self.view.frame.size.width;
    CGFloat height = self.view.frame.size.height;

    UILabel* label = [[UILabel alloc] initWithFrame:CGRectMake(4, 30, width - 8, 30)];
    label.text = @"CBBObjectChannel (native)";
    [self.view addSubview:label];

    // ボタンを準備
    [self addButton:CGRectMake(4, 70, 312, 30) title:@"new MyClassJS" action:@selector(newJsInstance:)];
    [self addButton:CGRectMake(4, 110, 312, 30) title:@"invoke MyClassJS.foo" action:@selector(callJsMethod:)];
    [self addButton:CGRectMake(4, 150, 312, 30) title:@"destroy MyClassJS" action:@selector(destroyJsInstance:)];
    [self addButton:CGRectMake(4, 190, 312, 30) title:@"destroy" action:@selector(destroy:)];

    // WKWebViewを準備（※この時点ではまだコンテンツを読み込まない）
    _webView = [[WKWebView alloc]
        initWithFrame:CGRectMake(4, height / 2 + 4, width - 8, height / 2 - 8)];
    _webView.layer.borderWidth = 2.0f;
    _webView.layer.borderColor = [[UIColor blueColor] CGColor];
    _webView.layer.cornerRadius = 10.0f;
    _webView.navigationDelegate = self;
    _webView.autoresizingMask =
        UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    _webView.UIDelegate = self;
    // WKWebView　は App bundle のファイルを読めない為, bundleの内容を tmp へコピーしてそこから読み込む
    [self copyWithTarget:@"index.html"];
    [self copyWithTarget:@"script.js"];
    [self copyWithTarget:@"object-channel-wrapper.js"];
    [self.view addSubview:_webView];

    // CBBFunctionChannelを準備
    _dataBus = [[CBBWKWebViewDataBus alloc] initWithWKWebView:_webView];
    _objectChannel = [[CBBDirectObjectChannel alloc] initWithDataBus:_dataBus];

    // JavaScript側から操作されるクラスをbind
    [_objectChannel bindClass:[MyClassObjc class]];

    // WKWebView にコンテンツを読み込む（CBBDataBusがインジェクトされる）
    NSURL* url = [NSURL URLWithString:[NSString stringWithFormat:@"file://%@/index.html", [self getTmpDirectory]]];
    [_webView loadFileURL:url allowingReadAccessToURL:url];
}

- (void)didReceiveMemoryWarning
{
    [super didReceiveMemoryWarning];
}

- (void)addButton:(CGRect)frame title:(NSString*)title action:(SEL)sel
{
    UIButton* b = [UIButton buttonWithType:UIButtonTypeRoundedRect];
    b.frame = frame;
    b.layer.cornerRadius = 2.0;
    b.layer.borderColor = [[UIColor blueColor] CGColor];
    b.layer.borderWidth = 1.0;
    [b setTitle:title forState:UIControlStateNormal];
    [b addTarget:self action:sel forControlEvents:UIControlEventTouchDown];
    [self.view addSubview:b];
}

- (void)newJsInstance:(id)inSender
{
    if (!_remoteObject) {
        [_objectChannel createRemoteObjectWithClassName:@"MyClassJS"
                                              arguments:@[ @"test" ]
                                               callback:^(CBBRemoteObject* _Nullable remoteObject) {
                                                   self.remoteObject = remoteObject;
                                                   [self alert:[[NSString alloc] initWithFormat:@"result of new: %@", remoteObject]];
                                               }];
    } else {
        [self alert:@"already exist"];
    }
}

- (void)callJsMethod:(id)inSender
{
    if (_remoteObject) {
        [_remoteObject invokeWithMethod:@"foo"
                              arguments:@[ @"One", @(2), @"3" ]
                               callback:^(NSError* _Nullable error, id _Nullable result) {
                                   [self alert:[[NSString alloc] initWithFormat:@"result of foo: %@\nerror: %@", result, error]];
                               }];
    } else {
        [self alert:@"not exist"];
    }
}

- (void)destroyJsInstance:(id)inSender
{
    if (_remoteObject) {
        [_remoteObject destroy];
        _remoteObject = nil;
    } else {
        [self alert:@"not exist"];
    }
}

- (void)destroy:(id)inSender
{
    [_objectChannel destroy];
    [_dataBus destroy];
}

- (void)alert:(NSString*)message
{
    UIAlertController* alert =
        [UIAlertController alertControllerWithTitle:@"Alert from Native"
                                            message:message
                                     preferredStyle:UIAlertControllerStyleAlert];
    UIAlertAction* ok = [UIAlertAction actionWithTitle:@"OK"
                                                 style:UIAlertActionStyleDefault
                                               handler:^(UIAlertAction* action) {
                                                   [alert dismissViewControllerAnimated:YES completion:nil];
                                               }];
    [alert addAction:ok];
    [self presentViewController:alert animated:YES completion:nil];
}

- (NSString*)getTmpDirectory
{
    return [NSTemporaryDirectory() stringByAppendingPathComponent:@"www"];
}

// AppBundleの内容はWKWebViewから参照できないのでテンポラリディレクトリにコピーして用いる
- (BOOL)copyWithTarget:(NSString*)target
{
    NSBundle* mainBundle = [NSBundle mainBundle];
    NSString* sourceFile = [mainBundle pathForResource:target
                                                ofType:@""
                                           inDirectory:@"www"];
    NSString* tmpFolder = [self getTmpDirectory];
    [[NSFileManager defaultManager] createDirectoryAtPath:tmpFolder
                              withIntermediateDirectories:YES
                                               attributes:nil
                                                    error:nil];
    NSString* destFile = [tmpFolder stringByAppendingPathComponent:target];
    NSError* err;
    NSFileManager* fileManager = [NSFileManager defaultManager];
    if (![fileManager fileExistsAtPath:sourceFile]) {
        return NO;
    }
    CFUUIDRef uuidRef = CFUUIDCreate(kCFAllocatorDefault);
    CFStringRef uuidString = CFUUIDCreateString(kCFAllocatorDefault, uuidRef);
    CFRelease(uuidString);
    CFRelease(uuidRef);
    BOOL destExists = [fileManager fileExistsAtPath:destFile];
    if (destExists && ![fileManager removeItemAtPath:destFile error:nil])
        return NO;
    if (!destExists && ![fileManager createDirectoryAtPath:[destFile stringByDeletingLastPathComponent]
                               withIntermediateDirectories:YES
                                                attributes:nil
                                                     error:nil]) {
        return NO;
    }
    BOOL result = [fileManager copyItemAtPath:sourceFile toPath:destFile error:nil];
    if (err)
        NSLog(@"error: %@", err);
    NSLog(@"copy \"%@\" to \"%@\" <%s>", sourceFile, destFile, result ? "succeed" : "failed");
    return result;
}

// JavaScript側でalertを発行した時の処理
- (void)webView:(WKWebView*)webView
    runJavaScriptAlertPanelWithMessage:(NSString*)message
                      initiatedByFrame:(WKFrameInfo*)frame
                     completionHandler:(void (^)(void))completionHandler
{
    UIAlertController* alert =
        [UIAlertController alertControllerWithTitle:@"Alert from JS"
                                            message:message
                                     preferredStyle:UIAlertControllerStyleAlert];
    UIAlertAction* ok = [UIAlertAction actionWithTitle:@"OK"
                                                 style:UIAlertActionStyleDefault
                                               handler:^(UIAlertAction* action) {
                                                   [alert dismissViewControllerAnimated:YES completion:nil];
                                                   completionHandler();
                                               }];
    [alert addAction:ok];
    [self presentViewController:alert animated:YES completion:nil];
}

@end
