// Copyright © 2017 DWANGO Co., Ltd.

var dataBus = new CBB.WebViewDataBus();
var oc = require('@cross-border-bridge/object-channel-wrapper');
var objectChannel = new oc.ObjectChannelWrapper(dataBus);

// RPC実行されるクラスを定義
MyClassJS = (function() {
             var _foo;
             var _hoge;
             
             // コンストラクタ
             function MyClassJS(foo, hoge) {
             console.log("executing constructor of MyClassJS: " + foo + ", " + hoge);
             _foo = foo;
             _hoge = hoge;
             }
             
             // メソッド
             MyClassJS.prototype.foo = function(a1, a2, a3) {
             console.log("executing MyClassJS.foo(" + a1 + "," + a2 + "," + a3 + ":" + _foo + ")");
             return a1 + a2 + a3 + _foo;
             }
             
             // デストラクタ
             MyClassJS.prototype.destroy = function() {
             console.log("executing destructor of MyClassJS");
             }
             return MyClassJS;
             })();

// リモートからの受け口を作成
objectChannel.bind(MyClassJS);

// リモート側のインスタンスを生成
function OnButtonClickNew() {
    if (this.object) {
        alert("remote object has already created.");
        return;
    }
    // リモートのクラスからオブジェクトを作成
    console.log("new MyClassObjc");
    var _this = this;
    objectChannel.create("MyClassObjc", [], function(error, object) {
                         _this.object = object;
                         alert("created a remote object.");
                         });
}

// リモート側のメソッドを実行（同期）
function OnButtonClickInvoke() {
    if (!this.object) {
        alert("remote object is not exist.");
        return;
    }
    console.log("invoke MyClassObjc.foo");
    this.object.invoke("foo", ["a1", "a2", "a3"], function(error, result) {
                       console.log("executed MyClassObjc.foo: result=" + result);
                       alert("result: " + result);
                       });
}

// リモート側のメソッドを実行（非同期）
function OnButtonClickInvokeA() {
    if (!this.object) {
        alert("remote object is not exist.");
        return;
    }
    console.log("invoke MyClassObjc.fooA");
    this.object.invoke("fooA", ["a1", "a2", "a3"], function(error, result) {
                       console.log("executed MyClassObjc.fooA: result=" + result);
                       alert("result: " + result);
                       });
}

// リモート側のオブジェクトを破棄
function OnButtonClickDestroy() {
    if (!this.object) {
        alert("remote object has already destroyed.");
        return;
    }
    console.log("invoke destructor of MyClassObjc");
    this.object.destroy();
    this.object = undefined;
    alert("destroyed a remote object.");
}

// ObjectChannel（他）を破棄
function OnButtonClickDestroyAll() {
    objectChannel.destroy();
    dataBus.destroy();
}
