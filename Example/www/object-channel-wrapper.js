require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
var dc = require("@cross-border-bridge/data-channel");
var fc = require("@cross-border-bridge/function-channel");
var oc = require("@cross-border-bridge/object-channel");
var ObjectChannelWrapper = (function () {
    function ObjectChannelWrapper(dataBus) {
        this._dataBus = dataBus;
        this._dataChannel = new dc.DataChannel(this._dataBus);
        this._functionChannel = new fc.FunctionChannel(this._dataChannel);
        this._objectChannel = new oc.ObjectChannel(this._functionChannel);
    }
    ObjectChannelWrapper.prototype.bind = function (classFunction) {
        if (!this._objectChannel)
            return;
        this._objectChannel.bind(classFunction);
    };
    ObjectChannelWrapper.prototype.unbind = function (classFunction) {
        if (!this._objectChannel)
            return;
        this._objectChannel.unbind(classFunction);
    };
    ObjectChannelWrapper.prototype.create = function (className, args, callback, timeout) {
        if (!this._objectChannel)
            return;
        this._objectChannel.create(className, args, callback, timeout);
    };
    ObjectChannelWrapper.prototype.destroy = function () {
        this._objectChannel.destroy();
        this._objectChannel = undefined;
        this._functionChannel.destroy();
        this._functionChannel = undefined;
        this._dataChannel.destroy();
        this._dataChannel = undefined;
        this._dataBus = undefined;
    };
    ObjectChannelWrapper.prototype.destroyed = function () {
        return !this._objectChannel;
    };
    return ObjectChannelWrapper;
}());
exports.ObjectChannelWrapper = ObjectChannelWrapper;

},{"@cross-border-bridge/data-channel":3,"@cross-border-bridge/function-channel":5,"@cross-border-bridge/object-channel":10}],2:[function(require,module,exports){
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
/**
 * データ種別コード
 */
var DATA_TYPE_PUSH = 1;
var DATA_TYPE_REQUEST = 2;
var DATA_TYPE_RESPONSE = 3;
var DATA_TYPE_ERROR = 4;
/**
 * DataChannel内部エラー
 */
var DataChannelError = (function (_super) {
    __extends(DataChannelError, _super);
    function DataChannelError() {
        _super.apply(this, arguments);
    }
    return DataChannelError;
})(Error);
exports.DataChannelError = DataChannelError;
/**
 * DataBus上で単純なリクエスト＆レスポンス機構を提供する。
 */
var DataChannel = (function () {
    function DataChannel(dataBus) {
        this._handler = undefined;
        this._handlers = [];
        this._tagCount = 0;
        this._waitingCallbacks = {};
        this._timeoutObjects = {};
        this._dataBus = dataBus;
    }
    /**
     * DataChannelを破棄する際に実行する。
     * このメソッドを実行するとすべてのハンドラが解放され、レスポンス待ちの処理についてはエラーが返る。
     */
    DataChannel.prototype.destroy = function () {
        var _this = this;
        if (!this._dataBus)
            return;
        this.unregister();
        this._dataBus = undefined;
        this._handlers = undefined;
        Object.keys(this._waitingCallbacks).forEach(function (tag) {
            var error = new Error("plugin channel destroyed.");
            error.type = "Closed";
            _this.processCallback(tag, error);
        });
        this._waitingCallbacks = undefined;
    };
    /**
     * このDataChannelが既に破棄されたかどうかを返す
     *
     * @return 破棄されていればtrue、されていなければfalse
     */
    DataChannel.prototype.destroyed = function () {
        return !this._dataBus;
    };
    /**
     * メッセージハンドラの登録を行う
     *
     * @param handler メッセージ受信時に実行されるハンドラ
     * @return ハンドラID
     */
    DataChannel.prototype.addHandler = function (handler) {
        if (!Object.keys(this._handlers).length) {
            this.register();
        }
        if (this._handlers.indexOf(handler) === -1) {
            this._handlers.push(handler);
        }
    };
    /**
     * メッセージハンドラの解除を行う
     *
     * @param handlerId ハンドラ登録時に取得したハンドラID
     */
    DataChannel.prototype.removeHandler = function (handler) {
        this._handlers = this._handlers.filter(function (h) { return h !== handler; });
        if (!Object.keys(this._handlers).length) {
            this.unregister();
        }
    };
    /**
     * 登録されているすべてのメッセージハンドラの解除を行う
     */
    DataChannel.prototype.removeAllHandlers = function () {
        if (!Object.keys(this._handlers).length)
            return;
        this._handlers = [];
        this.unregister();
    };
    /**
     * メッセージの送信を行う。
     *
     * @param packet メッセージの実データ。フォーマットによって内容は自由に定義できる
     * @param callback メッセージに対してのレスポンスを受け取るコールバック。任意指定
     * @param timeout レスポンスを待つ待機時間。待機時間を過ぎるとcallbackにtimeoutエラーが返る。未指定時はタイムアウトしない。
     */
    DataChannel.prototype.send = function (packet, callback, timeout) {
        var _this = this;
        if (timeout === void 0) { timeout = 0; }
        if (callback) {
            this.register();
            var tag = this.acquireTag();
            if (0 < timeout) {
                var timeoutObject = setTimeout(function () {
                    var error = new Error("send timeout.");
                    error.type = "Timeout";
                    _this.processCallback(tag, error);
                }, timeout);
                this._timeoutObjects[tag] = timeoutObject;
            }
            this._waitingCallbacks[tag] = callback;
            this._dataBus.send(DATA_TYPE_REQUEST, [tag, packet]);
        }
        else {
            this._dataBus.send(DATA_TYPE_PUSH, [packet]);
        }
    };
    DataChannel.prototype.register = function () {
        var _this = this;
        if (this._handler)
            return;
        this._handler = function (dataType, data) {
            switch (dataType) {
                case DATA_TYPE_ERROR: {
                    var error = new DataChannelError();
                    error.type = data[1];
                    _this.processCallback(data[0], error);
                    return;
                }
                case DATA_TYPE_RESPONSE:
                    _this.processCallback(data[0], null, data[1]);
                    return;
                case DATA_TYPE_PUSH:
                    _this._handlers.forEach(function (handler) {
                        handler(data[0]);
                    });
                    return;
                case DATA_TYPE_REQUEST: {
                    var responseCallback = function (rpacket) {
                        _this._dataBus.send(DATA_TYPE_RESPONSE, [data[0], rpacket]);
                    };
                    _this._handlers.forEach(function (handler) {
                        handler(data[1], responseCallback);
                    });
                    return;
                }
            }
        };
        this._dataBus.addHandler(this._handler);
    };
    DataChannel.prototype.unregister = function () {
        if (!this._handler)
            return;
        this._dataBus.removeHandler(this._handler);
        this._handler = undefined;
    };
    DataChannel.prototype.processCallback = function (targetTag, error, packet) {
        var callback = this._waitingCallbacks[targetTag];
        if (callback) {
            delete this._waitingCallbacks[targetTag];
            delete this._timeoutObjects[targetTag];
            callback(error, packet);
            return true;
        }
        return false;
    };
    DataChannel.prototype.acquireTag = function () {
        return "c:" + ++this._tagCount;
    };
    return DataChannel;
})();
exports.DataChannel = DataChannel;

},{}],3:[function(require,module,exports){
var DataChannel_1 = require('./DataChannel');
exports.DataChannel = DataChannel_1.DataChannel;
exports.DataChannelError = DataChannel_1.DataChannelError;

},{"./DataChannel":2}],4:[function(require,module,exports){
"use strict";
/**
 * data-channel format
 */
var FMT_OMI = 'omi'; // Object Method Invocation
var FMT_EDO = 'edo'; // EncoDed Object
var FMT_ERR = 'err'; // ERRor
/**
 * error-type of function channel
 */
var ERROR_TYPE_OBJECT_NOT_BOUND = 'ObjectNotBound';
var ERROR_TYPE_METHOD_NOT_EXIST = 'MethodNotExist';
var FunctionChannel = (function () {
    /**
     * コンストラクタ (FunctionChannel を生成する)
     *
     * @param dataChannel DataChannel
     */
    function FunctionChannel(dataChannel) {
        this._bindingObjects = {};
        this._dataChannel = dataChannel;
        this._onReceivePacket = this.onReceivePacket.bind(this);
        this._dataChannel.addHandler(this._onReceivePacket);
    }
    /**
     * デストラクタ (FunctionChannel を破棄)
     */
    FunctionChannel.prototype.destroy = function () {
        if (!this._dataChannel)
            return;
        this._dataChannel.removeHandler(this._onReceivePacket);
        this._dataChannel = undefined;
        this._onReceivePacket = undefined;
        this._bindingObjects = {};
    };
    /**
     * 破棄済みか確認する
     *
     * @return 結果（true: 破棄済み, false: 破棄されていない）
     */
    FunctionChannel.prototype.destroyed = function () {
        return !this._dataChannel;
    };
    /**
     * オブジェクト識別子 と オブジェクト を紐付ける
     *
     * @param id オブジェクト識別子
     * @param object オブジェクト
     */
    FunctionChannel.prototype.bind = function (id, object) {
        if (!this._dataChannel)
            return;
        this._bindingObjects[id] = object;
    };
    /**
     * オブジェクト識別子 の紐付けを解除する
     *
     * @param id オブジェクト識別子
     */
    FunctionChannel.prototype.unbind = function (id) {
        if (!this._dataChannel)
            return;
        delete this._bindingObjects[id];
    };
    /**
     * 端方(native側) で bind されているオブジェクトのメソッドを実行する
     *
     * @param id 端方で bind されているオブジェクト識別子
     * @param method 実行するメソッド名
     * @param args 実行するメソッドに指定する引数
     * @param [callback] 実行結果の戻り値を受け取るハンドラ（戻り値が不要な場合は指定してなくよい）
     * @param [timeout] 応答待ちのタイムアウト
     */
    FunctionChannel.prototype.invoke = function (id, method, args, callback, timeout) {
        if (!this._dataChannel)
            return;
        var dcc;
        if (callback) {
            dcc = function (error, packet) {
                if (error) {
                    callback.apply(this, [error]);
                }
                else if (FMT_ERR === packet[0]) {
                    callback.apply(this, [packet[1]]);
                }
                else {
                    callback.apply(this, [undefined, packet[1]]);
                }
            };
        }
        else {
            dcc = undefined;
        }
        this._dataChannel.send([FMT_OMI, [id, method, args]], dcc, timeout);
    };
    FunctionChannel.prototype.onReceivePacket = function (packet, callback) {
        if (!this._dataChannel)
            return;
        if (packet[0] === FMT_OMI) {
            this.dispatchMethodInvocation(packet[1][0], packet[1][1], packet[1][2], callback);
        }
        else {
            console.warn('unknown format', packet[0]);
        }
    };
    FunctionChannel.prototype.dispatchMethodInvocation = function (id, methodName, args, callback) {
        if (!this._bindingObjects[id]) {
            if (callback)
                callback([FMT_ERR, ERROR_TYPE_OBJECT_NOT_BOUND]);
            return;
        }
        if (!this._bindingObjects[id][methodName]) {
            if (callback)
                callback([FMT_ERR, ERROR_TYPE_METHOD_NOT_EXIST]);
            return;
        }
        var result = (_a = this._bindingObjects[id])[methodName].apply(_a, args);
        if (callback)
            callback([FMT_EDO, result]);
        var _a;
    };
    return FunctionChannel;
}());
exports.FunctionChannel = FunctionChannel;

},{}],5:[function(require,module,exports){
"use strict";
var FunctionChannel_1 = require('./FunctionChannel');
exports.FunctionChannel = FunctionChannel_1.FunctionChannel;

},{"./FunctionChannel":4}],6:[function(require,module,exports){
"use strict";
var ObjectSpace_1 = require('./ObjectSpace');
var ObjectSpaceFC_1 = require('./ObjectSpaceFC');
var RemoteObject_1 = require('./RemoteObject');
var ObjectChannel = (function () {
    function ObjectChannel(functionChannel, objectSpace) {
        this._functionChannel = functionChannel;
        this._objectSpace = objectSpace ? objectSpace : ObjectChannel._globalObjectSpace;
        this._fc = new ObjectSpaceFC_1.ObjectSpaceFC(this._functionChannel, this._objectSpace);
        this._functionChannel.bind("$obj", this._fc);
    }
    /**
     * 破棄
     */
    ObjectChannel.prototype.destroy = function () {
        if (this.destroyed())
            return;
        this._functionChannel.unbind("$obj");
        this._functionChannel = undefined;
        this._objectSpace = undefined;
    };
    /**
     * 破棄済みかチェック
     *
     * @return 破棄済みの場合 true が返る
     */
    ObjectChannel.prototype.destroyed = function () {
        return !this._functionChannel;
    };
    /**
     * ローカル側のクラスをbind
     *
     * @param classFunction クラスが定義されたfunction
     */
    ObjectChannel.prototype.bind = function (classFunction) {
        if (this.destroyed())
            return;
        this._objectSpace.bindClass(this._getFunctionName(classFunction), classFunction);
    };
    /**
     * ローカル側のbindを解除
     *
     * @param classFunction クラスが定義されたfunctionまたはクラス名
     */
    ObjectChannel.prototype.unbind = function (classFunction) {
        if (this.destroyed())
            return;
        if ("string" === typeof classFunction) {
            this._objectSpace.unbindClass(classFunction);
        }
        else {
            this._objectSpace.unbindClass(this._getFunctionName(classFunction));
        }
    };
    /**
     * リモート側のオブジェクトを生成
     *
     * @param className クラス名
     * @param args コンストラクタに渡す引数
     * @param callback 結果を受け取るコールバック
     * @param [timeout] 応答待ちのタイムアウト
     */
    ObjectChannel.prototype.create = function (className, args, callback, timeout) {
        if (this.destroyed())
            return;
        var _this = this;
        this._functionChannel.invoke("$obj", "create", [className, args], function (error, result) {
            if (error) {
                callback.apply(_this, [error, undefined]);
            }
            else {
                callback.apply(_this, [undefined, new RemoteObject_1.RemoteObject(_this._functionChannel, _this._objectSpace, result)]);
            }
        }, timeout);
    };
    ObjectChannel.prototype._getFunctionName = function (f) {
        return f.name || f.toString().match(/^function\s?([^\s(]*)/)[1];
    };
    ObjectChannel._globalObjectSpace = new ObjectSpace_1.ObjectSpace();
    return ObjectChannel;
}());
exports.ObjectChannel = ObjectChannel;

},{"./ObjectSpace":7,"./ObjectSpaceFC":8,"./RemoteObject":9}],7:[function(require,module,exports){
"use strict";
var ObjectSpace = (function () {
    function ObjectSpace() {
        this._classes = {};
        this._objects = {};
        this._objectIds = {};
    }
    ObjectSpace.prototype.bindClass = function (className, handler) {
        this._classes[className] = handler;
    };
    ObjectSpace.prototype.unbindClass = function (className) {
        delete this._classes[className];
    };
    ObjectSpace.prototype.create = function (className, args) {
        var objectTag = this._acquireRemoteObjectTag(className);
        if (!this._classes[className]) {
            console.error("class not bind: " + className);
            return;
        }
        this._objects[objectTag] = this._createInstance(this._classes[className], args);
        return objectTag;
    };
    ObjectSpace.prototype.getObject = function (objectTag) {
        return this._objects[objectTag];
    };
    ObjectSpace.prototype.destroy = function (objectTag) {
        var object = this._objects[objectTag];
        if (!object) {
            console.error("object undefined: remote-object=" + objectTag);
            return;
        }
        if (object.destroy) {
            object.destroy();
        }
        else if (object.destructor) {
            object.destructor();
        }
        this._objects[objectTag] = undefined;
    };
    ObjectSpace.prototype._createInstance = function (ctor, args) {
        return new (Function.bind.apply(ctor, [null].concat(args[0])));
    };
    ObjectSpace.prototype._acquireRemoteObjectTag = function (className, objectId) {
        if (!this._objectIds[className]) {
            this._objectIds[className] = 0;
        }
        if (!objectId) {
            objectId = this._objectIds[className] + 1;
            if (!objectId) {
                objectId = 1;
            }
        }
        if (objectId <= this._objectIds[className]) {
            console.error("invalid objectId was specified: " + objectId);
            return null;
        }
        this._objectIds[className] = objectId;
        return className + ":" + objectId;
    };
    return ObjectSpace;
}());
exports.ObjectSpace = ObjectSpace;

},{}],8:[function(require,module,exports){
"use strict";
var ObjectSpaceFC = (function () {
    function ObjectSpaceFC(functionChannel, objectSpace) {
        this._functionChannel = functionChannel;
        this._objectSpace = objectSpace;
    }
    ObjectSpaceFC.prototype.create = function (className) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var objectTag = this._objectSpace.create(className, args);
        if (!objectTag)
            return undefined;
        var localObject = this._objectSpace.getObject(objectTag);
        this._functionChannel.bind(objectTag, localObject);
        return objectTag;
    };
    ObjectSpaceFC.prototype.destroy = function (object) {
        this._objectSpace.destroy(object);
    };
    return ObjectSpaceFC;
}());
exports.ObjectSpaceFC = ObjectSpaceFC;

},{}],9:[function(require,module,exports){
"use strict";
/**
 * error-type of object channel
 */
var ERROR_TYPE_CLOSE = 'Close';
var RemoteObject = (function () {
    function RemoteObject(channel, space, tag) {
        this._channel = channel;
        this._space = space;
        this._tag = tag;
        this._destroyed = false;
    }
    /**
     * Native側のメソッドを実行
     *
     * @param method 実行するメソッド名
     * @param [args] 実行するメソッドに渡す引数
     * @param [callback] 結果を受け取るコールバック
     * @param [timeout] 応答待ちのタイムアウト
     * @return メソッドの戻り値
     */
    RemoteObject.prototype.invoke = function (method, args, callback, timeout) {
        if (this._destroyed) {
            if (callback)
                callback.apply(this, ["AlreadyDestroyed"]);
            return;
        }
        this._channel.invoke(this._tag, method, args, callback, timeout);
    };
    /**
     * Native側のオブジェクトを破棄
     */
    RemoteObject.prototype.destroy = function () {
        if (this._destroyed) {
            return;
        }
        this._channel.invoke("$obj", "destroy", [this._tag]);
        this._destroyed = true;
    };
    return RemoteObject;
}());
exports.RemoteObject = RemoteObject;

},{}],10:[function(require,module,exports){
"use strict";
var ObjectChannel_1 = require('./ObjectChannel');
exports.ObjectChannel = ObjectChannel_1.ObjectChannel;
var ObjectSpace_1 = require('./ObjectSpace');
exports.ObjectSpace = ObjectSpace_1.ObjectSpace;
var RemoteObject_1 = require('./RemoteObject');
exports.RemoteObject = RemoteObject_1.RemoteObject;

},{"./ObjectChannel":6,"./ObjectSpace":7,"./RemoteObject":9}],"@cross-border-bridge/object-channel-wrapper":[function(require,module,exports){
"use strict";
var ObjectChannelWrapper_1 = require('./ObjectChannelWrapper');
exports.ObjectChannelWrapper = ObjectChannelWrapper_1.ObjectChannelWrapper;

},{"./ObjectChannelWrapper":1}]},{},[])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvT2JqZWN0Q2hhbm5lbFdyYXBwZXIuanMiLCJub2RlX21vZHVsZXMvQGNyb3NzLWJvcmRlci1icmlkZ2UvZGF0YS1jaGFubmVsL2xpYi9EYXRhQ2hhbm5lbC5qcyIsIm5vZGVfbW9kdWxlcy9AY3Jvc3MtYm9yZGVyLWJyaWRnZS9kYXRhLWNoYW5uZWwvbGliL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL0Bjcm9zcy1ib3JkZXItYnJpZGdlL2Z1bmN0aW9uLWNoYW5uZWwvbGliL0Z1bmN0aW9uQ2hhbm5lbC5qcyIsIm5vZGVfbW9kdWxlcy9AY3Jvc3MtYm9yZGVyLWJyaWRnZS9mdW5jdGlvbi1jaGFubmVsL2xpYi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9AY3Jvc3MtYm9yZGVyLWJyaWRnZS9vYmplY3QtY2hhbm5lbC9saWIvT2JqZWN0Q2hhbm5lbC5qcyIsIm5vZGVfbW9kdWxlcy9AY3Jvc3MtYm9yZGVyLWJyaWRnZS9vYmplY3QtY2hhbm5lbC9saWIvT2JqZWN0U3BhY2UuanMiLCJub2RlX21vZHVsZXMvQGNyb3NzLWJvcmRlci1icmlkZ2Uvb2JqZWN0LWNoYW5uZWwvbGliL09iamVjdFNwYWNlRkMuanMiLCJub2RlX21vZHVsZXMvQGNyb3NzLWJvcmRlci1icmlkZ2Uvb2JqZWN0LWNoYW5uZWwvbGliL1JlbW90ZU9iamVjdC5qcyIsIm5vZGVfbW9kdWxlcy9AY3Jvc3MtYm9yZGVyLWJyaWRnZS9vYmplY3QtY2hhbm5lbC9saWIvaW5kZXguanMiLCJsaWIvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbExBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUhBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIlwidXNlIHN0cmljdFwiO1xudmFyIGRjID0gcmVxdWlyZShcIkBjcm9zcy1ib3JkZXItYnJpZGdlL2RhdGEtY2hhbm5lbFwiKTtcbnZhciBmYyA9IHJlcXVpcmUoXCJAY3Jvc3MtYm9yZGVyLWJyaWRnZS9mdW5jdGlvbi1jaGFubmVsXCIpO1xudmFyIG9jID0gcmVxdWlyZShcIkBjcm9zcy1ib3JkZXItYnJpZGdlL29iamVjdC1jaGFubmVsXCIpO1xudmFyIE9iamVjdENoYW5uZWxXcmFwcGVyID0gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBPYmplY3RDaGFubmVsV3JhcHBlcihkYXRhQnVzKSB7XG4gICAgICAgIHRoaXMuX2RhdGFCdXMgPSBkYXRhQnVzO1xuICAgICAgICB0aGlzLl9kYXRhQ2hhbm5lbCA9IG5ldyBkYy5EYXRhQ2hhbm5lbCh0aGlzLl9kYXRhQnVzKTtcbiAgICAgICAgdGhpcy5fZnVuY3Rpb25DaGFubmVsID0gbmV3IGZjLkZ1bmN0aW9uQ2hhbm5lbCh0aGlzLl9kYXRhQ2hhbm5lbCk7XG4gICAgICAgIHRoaXMuX29iamVjdENoYW5uZWwgPSBuZXcgb2MuT2JqZWN0Q2hhbm5lbCh0aGlzLl9mdW5jdGlvbkNoYW5uZWwpO1xuICAgIH1cbiAgICBPYmplY3RDaGFubmVsV3JhcHBlci5wcm90b3R5cGUuYmluZCA9IGZ1bmN0aW9uIChjbGFzc0Z1bmN0aW9uKSB7XG4gICAgICAgIGlmICghdGhpcy5fb2JqZWN0Q2hhbm5lbClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgdGhpcy5fb2JqZWN0Q2hhbm5lbC5iaW5kKGNsYXNzRnVuY3Rpb24pO1xuICAgIH07XG4gICAgT2JqZWN0Q2hhbm5lbFdyYXBwZXIucHJvdG90eXBlLnVuYmluZCA9IGZ1bmN0aW9uIChjbGFzc0Z1bmN0aW9uKSB7XG4gICAgICAgIGlmICghdGhpcy5fb2JqZWN0Q2hhbm5lbClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgdGhpcy5fb2JqZWN0Q2hhbm5lbC51bmJpbmQoY2xhc3NGdW5jdGlvbik7XG4gICAgfTtcbiAgICBPYmplY3RDaGFubmVsV3JhcHBlci5wcm90b3R5cGUuY3JlYXRlID0gZnVuY3Rpb24gKGNsYXNzTmFtZSwgYXJncywgY2FsbGJhY2ssIHRpbWVvdXQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9vYmplY3RDaGFubmVsKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB0aGlzLl9vYmplY3RDaGFubmVsLmNyZWF0ZShjbGFzc05hbWUsIGFyZ3MsIGNhbGxiYWNrLCB0aW1lb3V0KTtcbiAgICB9O1xuICAgIE9iamVjdENoYW5uZWxXcmFwcGVyLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLl9vYmplY3RDaGFubmVsLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5fb2JqZWN0Q2hhbm5lbCA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fZnVuY3Rpb25DaGFubmVsLmRlc3Ryb3koKTtcbiAgICAgICAgdGhpcy5fZnVuY3Rpb25DaGFubmVsID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLl9kYXRhQ2hhbm5lbC5kZXN0cm95KCk7XG4gICAgICAgIHRoaXMuX2RhdGFDaGFubmVsID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLl9kYXRhQnVzID0gdW5kZWZpbmVkO1xuICAgIH07XG4gICAgT2JqZWN0Q2hhbm5lbFdyYXBwZXIucHJvdG90eXBlLmRlc3Ryb3llZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICF0aGlzLl9vYmplY3RDaGFubmVsO1xuICAgIH07XG4gICAgcmV0dXJuIE9iamVjdENoYW5uZWxXcmFwcGVyO1xufSgpKTtcbmV4cG9ydHMuT2JqZWN0Q2hhbm5lbFdyYXBwZXIgPSBPYmplY3RDaGFubmVsV3JhcHBlcjtcbiIsInZhciBfX2V4dGVuZHMgPSAodGhpcyAmJiB0aGlzLl9fZXh0ZW5kcykgfHwgZnVuY3Rpb24gKGQsIGIpIHtcbiAgICBmb3IgKHZhciBwIGluIGIpIGlmIChiLmhhc093blByb3BlcnR5KHApKSBkW3BdID0gYltwXTtcbiAgICBmdW5jdGlvbiBfXygpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGQ7IH1cbiAgICBkLnByb3RvdHlwZSA9IGIgPT09IG51bGwgPyBPYmplY3QuY3JlYXRlKGIpIDogKF9fLnByb3RvdHlwZSA9IGIucHJvdG90eXBlLCBuZXcgX18oKSk7XG59O1xuLyoqXG4gKiDjg4fjg7zjgr/nqK7liKXjgrPjg7zjg4lcbiAqL1xudmFyIERBVEFfVFlQRV9QVVNIID0gMTtcbnZhciBEQVRBX1RZUEVfUkVRVUVTVCA9IDI7XG52YXIgREFUQV9UWVBFX1JFU1BPTlNFID0gMztcbnZhciBEQVRBX1RZUEVfRVJST1IgPSA0O1xuLyoqXG4gKiBEYXRhQ2hhbm5lbOWGhemDqOOCqOODqeODvFxuICovXG52YXIgRGF0YUNoYW5uZWxFcnJvciA9IChmdW5jdGlvbiAoX3N1cGVyKSB7XG4gICAgX19leHRlbmRzKERhdGFDaGFubmVsRXJyb3IsIF9zdXBlcik7XG4gICAgZnVuY3Rpb24gRGF0YUNoYW5uZWxFcnJvcigpIHtcbiAgICAgICAgX3N1cGVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICAgIHJldHVybiBEYXRhQ2hhbm5lbEVycm9yO1xufSkoRXJyb3IpO1xuZXhwb3J0cy5EYXRhQ2hhbm5lbEVycm9yID0gRGF0YUNoYW5uZWxFcnJvcjtcbi8qKlxuICogRGF0YUJ1c+S4iuOBp+WNmOe0lOOBquODquOCr+OCqOOCueODiO+8huODrOOCueODneODs+OCueapn+ani+OCkuaPkOS+m+OBmeOCi+OAglxuICovXG52YXIgRGF0YUNoYW5uZWwgPSAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIERhdGFDaGFubmVsKGRhdGFCdXMpIHtcbiAgICAgICAgdGhpcy5faGFuZGxlciA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5faGFuZGxlcnMgPSBbXTtcbiAgICAgICAgdGhpcy5fdGFnQ291bnQgPSAwO1xuICAgICAgICB0aGlzLl93YWl0aW5nQ2FsbGJhY2tzID0ge307XG4gICAgICAgIHRoaXMuX3RpbWVvdXRPYmplY3RzID0ge307XG4gICAgICAgIHRoaXMuX2RhdGFCdXMgPSBkYXRhQnVzO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBEYXRhQ2hhbm5lbOOCkuegtOajhOOBmeOCi+mam+OBq+Wun+ihjOOBmeOCi+OAglxuICAgICAqIOOBk+OBruODoeOCveODg+ODieOCkuWun+ihjOOBmeOCi+OBqOOBmeOBueOBpuOBruODj+ODs+ODieODqeOBjOino+aUvuOBleOCjOOAgeODrOOCueODneODs+OCueW+heOBoeOBruWHpueQhuOBq+OBpOOBhOOBpuOBr+OCqOODqeODvOOBjOi/lOOCi+OAglxuICAgICAqL1xuICAgIERhdGFDaGFubmVsLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICBpZiAoIXRoaXMuX2RhdGFCdXMpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHRoaXMudW5yZWdpc3RlcigpO1xuICAgICAgICB0aGlzLl9kYXRhQnVzID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLl9oYW5kbGVycyA9IHVuZGVmaW5lZDtcbiAgICAgICAgT2JqZWN0LmtleXModGhpcy5fd2FpdGluZ0NhbGxiYWNrcykuZm9yRWFjaChmdW5jdGlvbiAodGFnKSB7XG4gICAgICAgICAgICB2YXIgZXJyb3IgPSBuZXcgRXJyb3IoXCJwbHVnaW4gY2hhbm5lbCBkZXN0cm95ZWQuXCIpO1xuICAgICAgICAgICAgZXJyb3IudHlwZSA9IFwiQ2xvc2VkXCI7XG4gICAgICAgICAgICBfdGhpcy5wcm9jZXNzQ2FsbGJhY2sodGFnLCBlcnJvcik7XG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLl93YWl0aW5nQ2FsbGJhY2tzID0gdW5kZWZpbmVkO1xuICAgIH07XG4gICAgLyoqXG4gICAgICog44GT44GuRGF0YUNoYW5uZWzjgYzml6LjgavnoLTmo4TjgZXjgozjgZ/jgYvjganjgYbjgYvjgpLov5TjgZlcbiAgICAgKlxuICAgICAqIEByZXR1cm4g56C05qOE44GV44KM44Gm44GE44KM44GwdHJ1ZeOAgeOBleOCjOOBpuOBhOOBquOBkeOCjOOBsGZhbHNlXG4gICAgICovXG4gICAgRGF0YUNoYW5uZWwucHJvdG90eXBlLmRlc3Ryb3llZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICF0aGlzLl9kYXRhQnVzO1xuICAgIH07XG4gICAgLyoqXG4gICAgICog44Oh44OD44K744O844K444OP44Oz44OJ44Op44Gu55m76Yyy44KS6KGM44GGXG4gICAgICpcbiAgICAgKiBAcGFyYW0gaGFuZGxlciDjg6Hjg4Pjgrvjg7zjgrjlj5fkv6HmmYLjgavlrp/ooYzjgZXjgozjgovjg4/jg7Pjg4njg6lcbiAgICAgKiBAcmV0dXJuIOODj+ODs+ODieODqUlEXG4gICAgICovXG4gICAgRGF0YUNoYW5uZWwucHJvdG90eXBlLmFkZEhhbmRsZXIgPSBmdW5jdGlvbiAoaGFuZGxlcikge1xuICAgICAgICBpZiAoIU9iamVjdC5rZXlzKHRoaXMuX2hhbmRsZXJzKS5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMucmVnaXN0ZXIoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5faGFuZGxlcnMuaW5kZXhPZihoYW5kbGVyKSA9PT0gLTEpIHtcbiAgICAgICAgICAgIHRoaXMuX2hhbmRsZXJzLnB1c2goaGFuZGxlcik7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIC8qKlxuICAgICAqIOODoeODg+OCu+ODvOOCuOODj+ODs+ODieODqeOBruino+mZpOOCkuihjOOBhlxuICAgICAqXG4gICAgICogQHBhcmFtIGhhbmRsZXJJZCDjg4/jg7Pjg4njg6nnmbvpjLLmmYLjgavlj5blvpfjgZfjgZ/jg4/jg7Pjg4njg6lJRFxuICAgICAqL1xuICAgIERhdGFDaGFubmVsLnByb3RvdHlwZS5yZW1vdmVIYW5kbGVyID0gZnVuY3Rpb24gKGhhbmRsZXIpIHtcbiAgICAgICAgdGhpcy5faGFuZGxlcnMgPSB0aGlzLl9oYW5kbGVycy5maWx0ZXIoZnVuY3Rpb24gKGgpIHsgcmV0dXJuIGggIT09IGhhbmRsZXI7IH0pO1xuICAgICAgICBpZiAoIU9iamVjdC5rZXlzKHRoaXMuX2hhbmRsZXJzKS5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMudW5yZWdpc3RlcigpO1xuICAgICAgICB9XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiDnmbvpjLLjgZXjgozjgabjgYTjgovjgZnjgbnjgabjga7jg6Hjg4Pjgrvjg7zjgrjjg4/jg7Pjg4njg6njga7op6PpmaTjgpLooYzjgYZcbiAgICAgKi9cbiAgICBEYXRhQ2hhbm5lbC5wcm90b3R5cGUucmVtb3ZlQWxsSGFuZGxlcnMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghT2JqZWN0LmtleXModGhpcy5faGFuZGxlcnMpLmxlbmd0aClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgdGhpcy5faGFuZGxlcnMgPSBbXTtcbiAgICAgICAgdGhpcy51bnJlZ2lzdGVyKCk7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiDjg6Hjg4Pjgrvjg7zjgrjjga7pgIHkv6HjgpLooYzjgYbjgIJcbiAgICAgKlxuICAgICAqIEBwYXJhbSBwYWNrZXQg44Oh44OD44K744O844K444Gu5a6f44OH44O844K/44CC44OV44Kp44O844Oe44OD44OI44Gr44KI44Gj44Gm5YaF5a6544Gv6Ieq55Sx44Gr5a6a576p44Gn44GN44KLXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOODoeODg+OCu+ODvOOCuOOBq+WvvuOBl+OBpuOBruODrOOCueODneODs+OCueOCkuWPl+OBkeWPluOCi+OCs+ODvOODq+ODkOODg+OCr+OAguS7u+aEj+aMh+WumlxuICAgICAqIEBwYXJhbSB0aW1lb3V0IOODrOOCueODneODs+OCueOCkuW+heOBpOW+heapn+aZgumWk+OAguW+heapn+aZgumWk+OCkumBjuOBjuOCi+OBqGNhbGxiYWNr44GrdGltZW91dOOCqOODqeODvOOBjOi/lOOCi+OAguacquaMh+WumuaZguOBr+OCv+OCpOODoOOCouOCpuODiOOBl+OBquOBhOOAglxuICAgICAqL1xuICAgIERhdGFDaGFubmVsLnByb3RvdHlwZS5zZW5kID0gZnVuY3Rpb24gKHBhY2tldCwgY2FsbGJhY2ssIHRpbWVvdXQpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgaWYgKHRpbWVvdXQgPT09IHZvaWQgMCkgeyB0aW1lb3V0ID0gMDsgfVxuICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgIHRoaXMucmVnaXN0ZXIoKTtcbiAgICAgICAgICAgIHZhciB0YWcgPSB0aGlzLmFjcXVpcmVUYWcoKTtcbiAgICAgICAgICAgIGlmICgwIDwgdGltZW91dCkge1xuICAgICAgICAgICAgICAgIHZhciB0aW1lb3V0T2JqZWN0ID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBlcnJvciA9IG5ldyBFcnJvcihcInNlbmQgdGltZW91dC5cIik7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yLnR5cGUgPSBcIlRpbWVvdXRcIjtcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMucHJvY2Vzc0NhbGxiYWNrKHRhZywgZXJyb3IpO1xuICAgICAgICAgICAgICAgIH0sIHRpbWVvdXQpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3RpbWVvdXRPYmplY3RzW3RhZ10gPSB0aW1lb3V0T2JqZWN0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fd2FpdGluZ0NhbGxiYWNrc1t0YWddID0gY2FsbGJhY2s7XG4gICAgICAgICAgICB0aGlzLl9kYXRhQnVzLnNlbmQoREFUQV9UWVBFX1JFUVVFU1QsIFt0YWcsIHBhY2tldF0pO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5fZGF0YUJ1cy5zZW5kKERBVEFfVFlQRV9QVVNILCBbcGFja2V0XSk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIERhdGFDaGFubmVsLnByb3RvdHlwZS5yZWdpc3RlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgaWYgKHRoaXMuX2hhbmRsZXIpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHRoaXMuX2hhbmRsZXIgPSBmdW5jdGlvbiAoZGF0YVR5cGUsIGRhdGEpIHtcbiAgICAgICAgICAgIHN3aXRjaCAoZGF0YVR5cGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlIERBVEFfVFlQRV9FUlJPUjoge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZXJyb3IgPSBuZXcgRGF0YUNoYW5uZWxFcnJvcigpO1xuICAgICAgICAgICAgICAgICAgICBlcnJvci50eXBlID0gZGF0YVsxXTtcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMucHJvY2Vzc0NhbGxiYWNrKGRhdGFbMF0sIGVycm9yKTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXNlIERBVEFfVFlQRV9SRVNQT05TRTpcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMucHJvY2Vzc0NhbGxiYWNrKGRhdGFbMF0sIG51bGwsIGRhdGFbMV0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgY2FzZSBEQVRBX1RZUEVfUFVTSDpcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMuX2hhbmRsZXJzLmZvckVhY2goZnVuY3Rpb24gKGhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZXIoZGF0YVswXSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgY2FzZSBEQVRBX1RZUEVfUkVRVUVTVDoge1xuICAgICAgICAgICAgICAgICAgICB2YXIgcmVzcG9uc2VDYWxsYmFjayA9IGZ1bmN0aW9uIChycGFja2V0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfdGhpcy5fZGF0YUJ1cy5zZW5kKERBVEFfVFlQRV9SRVNQT05TRSwgW2RhdGFbMF0sIHJwYWNrZXRdKTtcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgX3RoaXMuX2hhbmRsZXJzLmZvckVhY2goZnVuY3Rpb24gKGhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZXIoZGF0YVsxXSwgcmVzcG9uc2VDYWxsYmFjayk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLl9kYXRhQnVzLmFkZEhhbmRsZXIodGhpcy5faGFuZGxlcik7XG4gICAgfTtcbiAgICBEYXRhQ2hhbm5lbC5wcm90b3R5cGUudW5yZWdpc3RlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9oYW5kbGVyKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB0aGlzLl9kYXRhQnVzLnJlbW92ZUhhbmRsZXIodGhpcy5faGFuZGxlcik7XG4gICAgICAgIHRoaXMuX2hhbmRsZXIgPSB1bmRlZmluZWQ7XG4gICAgfTtcbiAgICBEYXRhQ2hhbm5lbC5wcm90b3R5cGUucHJvY2Vzc0NhbGxiYWNrID0gZnVuY3Rpb24gKHRhcmdldFRhZywgZXJyb3IsIHBhY2tldCkge1xuICAgICAgICB2YXIgY2FsbGJhY2sgPSB0aGlzLl93YWl0aW5nQ2FsbGJhY2tzW3RhcmdldFRhZ107XG4gICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMuX3dhaXRpbmdDYWxsYmFja3NbdGFyZ2V0VGFnXTtcbiAgICAgICAgICAgIGRlbGV0ZSB0aGlzLl90aW1lb3V0T2JqZWN0c1t0YXJnZXRUYWddO1xuICAgICAgICAgICAgY2FsbGJhY2soZXJyb3IsIHBhY2tldCk7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfTtcbiAgICBEYXRhQ2hhbm5lbC5wcm90b3R5cGUuYWNxdWlyZVRhZyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIFwiYzpcIiArICsrdGhpcy5fdGFnQ291bnQ7XG4gICAgfTtcbiAgICByZXR1cm4gRGF0YUNoYW5uZWw7XG59KSgpO1xuZXhwb3J0cy5EYXRhQ2hhbm5lbCA9IERhdGFDaGFubmVsO1xuIiwidmFyIERhdGFDaGFubmVsXzEgPSByZXF1aXJlKCcuL0RhdGFDaGFubmVsJyk7XG5leHBvcnRzLkRhdGFDaGFubmVsID0gRGF0YUNoYW5uZWxfMS5EYXRhQ2hhbm5lbDtcbmV4cG9ydHMuRGF0YUNoYW5uZWxFcnJvciA9IERhdGFDaGFubmVsXzEuRGF0YUNoYW5uZWxFcnJvcjtcbiIsIlwidXNlIHN0cmljdFwiO1xuLyoqXG4gKiBkYXRhLWNoYW5uZWwgZm9ybWF0XG4gKi9cbnZhciBGTVRfT01JID0gJ29taSc7IC8vIE9iamVjdCBNZXRob2QgSW52b2NhdGlvblxudmFyIEZNVF9FRE8gPSAnZWRvJzsgLy8gRW5jb0RlZCBPYmplY3RcbnZhciBGTVRfRVJSID0gJ2Vycic7IC8vIEVSUm9yXG4vKipcbiAqIGVycm9yLXR5cGUgb2YgZnVuY3Rpb24gY2hhbm5lbFxuICovXG52YXIgRVJST1JfVFlQRV9PQkpFQ1RfTk9UX0JPVU5EID0gJ09iamVjdE5vdEJvdW5kJztcbnZhciBFUlJPUl9UWVBFX01FVEhPRF9OT1RfRVhJU1QgPSAnTWV0aG9kTm90RXhpc3QnO1xudmFyIEZ1bmN0aW9uQ2hhbm5lbCA9IChmdW5jdGlvbiAoKSB7XG4gICAgLyoqXG4gICAgICog44Kz44Oz44K544OI44Op44Kv44K/IChGdW5jdGlvbkNoYW5uZWwg44KS55Sf5oiQ44GZ44KLKVxuICAgICAqXG4gICAgICogQHBhcmFtIGRhdGFDaGFubmVsIERhdGFDaGFubmVsXG4gICAgICovXG4gICAgZnVuY3Rpb24gRnVuY3Rpb25DaGFubmVsKGRhdGFDaGFubmVsKSB7XG4gICAgICAgIHRoaXMuX2JpbmRpbmdPYmplY3RzID0ge307XG4gICAgICAgIHRoaXMuX2RhdGFDaGFubmVsID0gZGF0YUNoYW5uZWw7XG4gICAgICAgIHRoaXMuX29uUmVjZWl2ZVBhY2tldCA9IHRoaXMub25SZWNlaXZlUGFja2V0LmJpbmQodGhpcyk7XG4gICAgICAgIHRoaXMuX2RhdGFDaGFubmVsLmFkZEhhbmRsZXIodGhpcy5fb25SZWNlaXZlUGFja2V0KTtcbiAgICB9XG4gICAgLyoqXG4gICAgICog44OH44K544OI44Op44Kv44K/IChGdW5jdGlvbkNoYW5uZWwg44KS56C05qOEKVxuICAgICAqL1xuICAgIEZ1bmN0aW9uQ2hhbm5lbC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9kYXRhQ2hhbm5lbClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgdGhpcy5fZGF0YUNoYW5uZWwucmVtb3ZlSGFuZGxlcih0aGlzLl9vblJlY2VpdmVQYWNrZXQpO1xuICAgICAgICB0aGlzLl9kYXRhQ2hhbm5lbCA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5fb25SZWNlaXZlUGFja2V0ID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLl9iaW5kaW5nT2JqZWN0cyA9IHt9O1xuICAgIH07XG4gICAgLyoqXG4gICAgICog56C05qOE5riI44G/44GL56K66KqN44GZ44KLXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIOe1kOaenO+8iHRydWU6IOegtOajhOa4iOOBvywgZmFsc2U6IOegtOajhOOBleOCjOOBpuOBhOOBquOBhO+8iVxuICAgICAqL1xuICAgIEZ1bmN0aW9uQ2hhbm5lbC5wcm90b3R5cGUuZGVzdHJveWVkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gIXRoaXMuX2RhdGFDaGFubmVsO1xuICAgIH07XG4gICAgLyoqXG4gICAgICog44Kq44OW44K444Kn44Kv44OI6K2Y5Yil5a2QIOOBqCDjgqrjg5bjgrjjgqfjgq/jg4gg44KS57SQ5LuY44GR44KLXG4gICAgICpcbiAgICAgKiBAcGFyYW0gaWQg44Kq44OW44K444Kn44Kv44OI6K2Y5Yil5a2QXG4gICAgICogQHBhcmFtIG9iamVjdCDjgqrjg5bjgrjjgqfjgq/jg4hcbiAgICAgKi9cbiAgICBGdW5jdGlvbkNoYW5uZWwucHJvdG90eXBlLmJpbmQgPSBmdW5jdGlvbiAoaWQsIG9iamVjdCkge1xuICAgICAgICBpZiAoIXRoaXMuX2RhdGFDaGFubmVsKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB0aGlzLl9iaW5kaW5nT2JqZWN0c1tpZF0gPSBvYmplY3Q7XG4gICAgfTtcbiAgICAvKipcbiAgICAgKiDjgqrjg5bjgrjjgqfjgq/jg4jorZjliKXlrZAg44Gu57SQ5LuY44GR44KS6Kej6Zmk44GZ44KLXG4gICAgICpcbiAgICAgKiBAcGFyYW0gaWQg44Kq44OW44K444Kn44Kv44OI6K2Y5Yil5a2QXG4gICAgICovXG4gICAgRnVuY3Rpb25DaGFubmVsLnByb3RvdHlwZS51bmJpbmQgPSBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9kYXRhQ2hhbm5lbClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgZGVsZXRlIHRoaXMuX2JpbmRpbmdPYmplY3RzW2lkXTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIOerr+aWuShuYXRpdmXlgbQpIOOBpyBiaW5kIOOBleOCjOOBpuOBhOOCi+OCquODluOCuOOCp+OCr+ODiOOBruODoeOCveODg+ODieOCkuWun+ihjOOBmeOCi1xuICAgICAqXG4gICAgICogQHBhcmFtIGlkIOerr+aWueOBpyBiaW5kIOOBleOCjOOBpuOBhOOCi+OCquODluOCuOOCp+OCr+ODiOitmOWIpeWtkFxuICAgICAqIEBwYXJhbSBtZXRob2Qg5a6f6KGM44GZ44KL44Oh44K944OD44OJ5ZCNXG4gICAgICogQHBhcmFtIGFyZ3Mg5a6f6KGM44GZ44KL44Oh44K944OD44OJ44Gr5oyH5a6a44GZ44KL5byV5pWwXG4gICAgICogQHBhcmFtIFtjYWxsYmFja10g5a6f6KGM57WQ5p6c44Gu5oi744KK5YCk44KS5Y+X44GR5Y+W44KL44OP44Oz44OJ44Op77yI5oi744KK5YCk44GM5LiN6KaB44Gq5aC05ZCI44Gv5oyH5a6a44GX44Gm44Gq44GP44KI44GE77yJXG4gICAgICogQHBhcmFtIFt0aW1lb3V0XSDlv5znrZTlvoXjgaHjga7jgr/jgqTjg6DjgqLjgqbjg4hcbiAgICAgKi9cbiAgICBGdW5jdGlvbkNoYW5uZWwucHJvdG90eXBlLmludm9rZSA9IGZ1bmN0aW9uIChpZCwgbWV0aG9kLCBhcmdzLCBjYWxsYmFjaywgdGltZW91dCkge1xuICAgICAgICBpZiAoIXRoaXMuX2RhdGFDaGFubmVsKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB2YXIgZGNjO1xuICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGRjYyA9IGZ1bmN0aW9uIChlcnJvciwgcGFja2V0KSB7XG4gICAgICAgICAgICAgICAgaWYgKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KHRoaXMsIFtlcnJvcl0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChGTVRfRVJSID09PSBwYWNrZXRbMF0pIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgW3BhY2tldFsxXV0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgW3VuZGVmaW5lZCwgcGFja2V0WzFdXSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGRjYyA9IHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9kYXRhQ2hhbm5lbC5zZW5kKFtGTVRfT01JLCBbaWQsIG1ldGhvZCwgYXJnc11dLCBkY2MsIHRpbWVvdXQpO1xuICAgIH07XG4gICAgRnVuY3Rpb25DaGFubmVsLnByb3RvdHlwZS5vblJlY2VpdmVQYWNrZXQgPSBmdW5jdGlvbiAocGFja2V0LCBjYWxsYmFjaykge1xuICAgICAgICBpZiAoIXRoaXMuX2RhdGFDaGFubmVsKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBpZiAocGFja2V0WzBdID09PSBGTVRfT01JKSB7XG4gICAgICAgICAgICB0aGlzLmRpc3BhdGNoTWV0aG9kSW52b2NhdGlvbihwYWNrZXRbMV1bMF0sIHBhY2tldFsxXVsxXSwgcGFja2V0WzFdWzJdLCBjYWxsYmFjayk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oJ3Vua25vd24gZm9ybWF0JywgcGFja2V0WzBdKTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgRnVuY3Rpb25DaGFubmVsLnByb3RvdHlwZS5kaXNwYXRjaE1ldGhvZEludm9jYXRpb24gPSBmdW5jdGlvbiAoaWQsIG1ldGhvZE5hbWUsIGFyZ3MsIGNhbGxiYWNrKSB7XG4gICAgICAgIGlmICghdGhpcy5fYmluZGluZ09iamVjdHNbaWRdKSB7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spXG4gICAgICAgICAgICAgICAgY2FsbGJhY2soW0ZNVF9FUlIsIEVSUk9SX1RZUEVfT0JKRUNUX05PVF9CT1VORF0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICghdGhpcy5fYmluZGluZ09iamVjdHNbaWRdW21ldGhvZE5hbWVdKSB7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spXG4gICAgICAgICAgICAgICAgY2FsbGJhY2soW0ZNVF9FUlIsIEVSUk9SX1RZUEVfTUVUSE9EX05PVF9FWElTVF0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHZhciByZXN1bHQgPSAoX2EgPSB0aGlzLl9iaW5kaW5nT2JqZWN0c1tpZF0pW21ldGhvZE5hbWVdLmFwcGx5KF9hLCBhcmdzKTtcbiAgICAgICAgaWYgKGNhbGxiYWNrKVxuICAgICAgICAgICAgY2FsbGJhY2soW0ZNVF9FRE8sIHJlc3VsdF0pO1xuICAgICAgICB2YXIgX2E7XG4gICAgfTtcbiAgICByZXR1cm4gRnVuY3Rpb25DaGFubmVsO1xufSgpKTtcbmV4cG9ydHMuRnVuY3Rpb25DaGFubmVsID0gRnVuY3Rpb25DaGFubmVsO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgRnVuY3Rpb25DaGFubmVsXzEgPSByZXF1aXJlKCcuL0Z1bmN0aW9uQ2hhbm5lbCcpO1xuZXhwb3J0cy5GdW5jdGlvbkNoYW5uZWwgPSBGdW5jdGlvbkNoYW5uZWxfMS5GdW5jdGlvbkNoYW5uZWw7XG4iLCJcInVzZSBzdHJpY3RcIjtcbnZhciBPYmplY3RTcGFjZV8xID0gcmVxdWlyZSgnLi9PYmplY3RTcGFjZScpO1xudmFyIE9iamVjdFNwYWNlRkNfMSA9IHJlcXVpcmUoJy4vT2JqZWN0U3BhY2VGQycpO1xudmFyIFJlbW90ZU9iamVjdF8xID0gcmVxdWlyZSgnLi9SZW1vdGVPYmplY3QnKTtcbnZhciBPYmplY3RDaGFubmVsID0gKGZ1bmN0aW9uICgpIHtcbiAgICBmdW5jdGlvbiBPYmplY3RDaGFubmVsKGZ1bmN0aW9uQ2hhbm5lbCwgb2JqZWN0U3BhY2UpIHtcbiAgICAgICAgdGhpcy5fZnVuY3Rpb25DaGFubmVsID0gZnVuY3Rpb25DaGFubmVsO1xuICAgICAgICB0aGlzLl9vYmplY3RTcGFjZSA9IG9iamVjdFNwYWNlID8gb2JqZWN0U3BhY2UgOiBPYmplY3RDaGFubmVsLl9nbG9iYWxPYmplY3RTcGFjZTtcbiAgICAgICAgdGhpcy5fZmMgPSBuZXcgT2JqZWN0U3BhY2VGQ18xLk9iamVjdFNwYWNlRkModGhpcy5fZnVuY3Rpb25DaGFubmVsLCB0aGlzLl9vYmplY3RTcGFjZSk7XG4gICAgICAgIHRoaXMuX2Z1bmN0aW9uQ2hhbm5lbC5iaW5kKFwiJG9ialwiLCB0aGlzLl9mYyk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIOegtOajhFxuICAgICAqL1xuICAgIE9iamVjdENoYW5uZWwucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICh0aGlzLmRlc3Ryb3llZCgpKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB0aGlzLl9mdW5jdGlvbkNoYW5uZWwudW5iaW5kKFwiJG9ialwiKTtcbiAgICAgICAgdGhpcy5fZnVuY3Rpb25DaGFubmVsID0gdW5kZWZpbmVkO1xuICAgICAgICB0aGlzLl9vYmplY3RTcGFjZSA9IHVuZGVmaW5lZDtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIOegtOajhOa4iOOBv+OBi+ODgeOCp+ODg+OCr1xuICAgICAqXG4gICAgICogQHJldHVybiDnoLTmo4TmuIjjgb/jga7loLTlkIggdHJ1ZSDjgYzov5TjgotcbiAgICAgKi9cbiAgICBPYmplY3RDaGFubmVsLnByb3RvdHlwZS5kZXN0cm95ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAhdGhpcy5fZnVuY3Rpb25DaGFubmVsO1xuICAgIH07XG4gICAgLyoqXG4gICAgICog44Ot44O844Kr44Or5YG044Gu44Kv44Op44K544KSYmluZFxuICAgICAqXG4gICAgICogQHBhcmFtIGNsYXNzRnVuY3Rpb24g44Kv44Op44K544GM5a6a576p44GV44KM44GfZnVuY3Rpb25cbiAgICAgKi9cbiAgICBPYmplY3RDaGFubmVsLnByb3RvdHlwZS5iaW5kID0gZnVuY3Rpb24gKGNsYXNzRnVuY3Rpb24pIHtcbiAgICAgICAgaWYgKHRoaXMuZGVzdHJveWVkKCkpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHRoaXMuX29iamVjdFNwYWNlLmJpbmRDbGFzcyh0aGlzLl9nZXRGdW5jdGlvbk5hbWUoY2xhc3NGdW5jdGlvbiksIGNsYXNzRnVuY3Rpb24pO1xuICAgIH07XG4gICAgLyoqXG4gICAgICog44Ot44O844Kr44Or5YG044GuYmluZOOCkuino+mZpFxuICAgICAqXG4gICAgICogQHBhcmFtIGNsYXNzRnVuY3Rpb24g44Kv44Op44K544GM5a6a576p44GV44KM44GfZnVuY3Rpb27jgb7jgZ/jga/jgq/jg6njgrnlkI1cbiAgICAgKi9cbiAgICBPYmplY3RDaGFubmVsLnByb3RvdHlwZS51bmJpbmQgPSBmdW5jdGlvbiAoY2xhc3NGdW5jdGlvbikge1xuICAgICAgICBpZiAodGhpcy5kZXN0cm95ZWQoKSlcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgaWYgKFwic3RyaW5nXCIgPT09IHR5cGVvZiBjbGFzc0Z1bmN0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLl9vYmplY3RTcGFjZS51bmJpbmRDbGFzcyhjbGFzc0Z1bmN0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuX29iamVjdFNwYWNlLnVuYmluZENsYXNzKHRoaXMuX2dldEZ1bmN0aW9uTmFtZShjbGFzc0Z1bmN0aW9uKSk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIC8qKlxuICAgICAqIOODquODouODvOODiOWBtOOBruOCquODluOCuOOCp+OCr+ODiOOCkueUn+aIkFxuICAgICAqXG4gICAgICogQHBhcmFtIGNsYXNzTmFtZSDjgq/jg6njgrnlkI1cbiAgICAgKiBAcGFyYW0gYXJncyDjgrPjg7Pjgrnjg4jjg6njgq/jgr/jgavmuKHjgZnlvJXmlbBcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2sg57WQ5p6c44KS5Y+X44GR5Y+W44KL44Kz44O844Or44OQ44OD44KvXG4gICAgICogQHBhcmFtIFt0aW1lb3V0XSDlv5znrZTlvoXjgaHjga7jgr/jgqTjg6DjgqLjgqbjg4hcbiAgICAgKi9cbiAgICBPYmplY3RDaGFubmVsLnByb3RvdHlwZS5jcmVhdGUgPSBmdW5jdGlvbiAoY2xhc3NOYW1lLCBhcmdzLCBjYWxsYmFjaywgdGltZW91dCkge1xuICAgICAgICBpZiAodGhpcy5kZXN0cm95ZWQoKSlcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgdGhpcy5fZnVuY3Rpb25DaGFubmVsLmludm9rZShcIiRvYmpcIiwgXCJjcmVhdGVcIiwgW2NsYXNzTmFtZSwgYXJnc10sIGZ1bmN0aW9uIChlcnJvciwgcmVzdWx0KSB7XG4gICAgICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjay5hcHBseShfdGhpcywgW2Vycm9yLCB1bmRlZmluZWRdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrLmFwcGx5KF90aGlzLCBbdW5kZWZpbmVkLCBuZXcgUmVtb3RlT2JqZWN0XzEuUmVtb3RlT2JqZWN0KF90aGlzLl9mdW5jdGlvbkNoYW5uZWwsIF90aGlzLl9vYmplY3RTcGFjZSwgcmVzdWx0KV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCB0aW1lb3V0KTtcbiAgICB9O1xuICAgIE9iamVjdENoYW5uZWwucHJvdG90eXBlLl9nZXRGdW5jdGlvbk5hbWUgPSBmdW5jdGlvbiAoZikge1xuICAgICAgICByZXR1cm4gZi5uYW1lIHx8IGYudG9TdHJpbmcoKS5tYXRjaCgvXmZ1bmN0aW9uXFxzPyhbXlxccyhdKikvKVsxXTtcbiAgICB9O1xuICAgIE9iamVjdENoYW5uZWwuX2dsb2JhbE9iamVjdFNwYWNlID0gbmV3IE9iamVjdFNwYWNlXzEuT2JqZWN0U3BhY2UoKTtcbiAgICByZXR1cm4gT2JqZWN0Q2hhbm5lbDtcbn0oKSk7XG5leHBvcnRzLk9iamVjdENoYW5uZWwgPSBPYmplY3RDaGFubmVsO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgT2JqZWN0U3BhY2UgPSAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIE9iamVjdFNwYWNlKCkge1xuICAgICAgICB0aGlzLl9jbGFzc2VzID0ge307XG4gICAgICAgIHRoaXMuX29iamVjdHMgPSB7fTtcbiAgICAgICAgdGhpcy5fb2JqZWN0SWRzID0ge307XG4gICAgfVxuICAgIE9iamVjdFNwYWNlLnByb3RvdHlwZS5iaW5kQ2xhc3MgPSBmdW5jdGlvbiAoY2xhc3NOYW1lLCBoYW5kbGVyKSB7XG4gICAgICAgIHRoaXMuX2NsYXNzZXNbY2xhc3NOYW1lXSA9IGhhbmRsZXI7XG4gICAgfTtcbiAgICBPYmplY3RTcGFjZS5wcm90b3R5cGUudW5iaW5kQ2xhc3MgPSBmdW5jdGlvbiAoY2xhc3NOYW1lKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLl9jbGFzc2VzW2NsYXNzTmFtZV07XG4gICAgfTtcbiAgICBPYmplY3RTcGFjZS5wcm90b3R5cGUuY3JlYXRlID0gZnVuY3Rpb24gKGNsYXNzTmFtZSwgYXJncykge1xuICAgICAgICB2YXIgb2JqZWN0VGFnID0gdGhpcy5fYWNxdWlyZVJlbW90ZU9iamVjdFRhZyhjbGFzc05hbWUpO1xuICAgICAgICBpZiAoIXRoaXMuX2NsYXNzZXNbY2xhc3NOYW1lXSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcImNsYXNzIG5vdCBiaW5kOiBcIiArIGNsYXNzTmFtZSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fb2JqZWN0c1tvYmplY3RUYWddID0gdGhpcy5fY3JlYXRlSW5zdGFuY2UodGhpcy5fY2xhc3Nlc1tjbGFzc05hbWVdLCBhcmdzKTtcbiAgICAgICAgcmV0dXJuIG9iamVjdFRhZztcbiAgICB9O1xuICAgIE9iamVjdFNwYWNlLnByb3RvdHlwZS5nZXRPYmplY3QgPSBmdW5jdGlvbiAob2JqZWN0VGFnKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9vYmplY3RzW29iamVjdFRhZ107XG4gICAgfTtcbiAgICBPYmplY3RTcGFjZS5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uIChvYmplY3RUYWcpIHtcbiAgICAgICAgdmFyIG9iamVjdCA9IHRoaXMuX29iamVjdHNbb2JqZWN0VGFnXTtcbiAgICAgICAgaWYgKCFvYmplY3QpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJvYmplY3QgdW5kZWZpbmVkOiByZW1vdGUtb2JqZWN0PVwiICsgb2JqZWN0VGFnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAob2JqZWN0LmRlc3Ryb3kpIHtcbiAgICAgICAgICAgIG9iamVjdC5kZXN0cm95KCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAob2JqZWN0LmRlc3RydWN0b3IpIHtcbiAgICAgICAgICAgIG9iamVjdC5kZXN0cnVjdG9yKCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fb2JqZWN0c1tvYmplY3RUYWddID0gdW5kZWZpbmVkO1xuICAgIH07XG4gICAgT2JqZWN0U3BhY2UucHJvdG90eXBlLl9jcmVhdGVJbnN0YW5jZSA9IGZ1bmN0aW9uIChjdG9yLCBhcmdzKSB7XG4gICAgICAgIHJldHVybiBuZXcgKEZ1bmN0aW9uLmJpbmQuYXBwbHkoY3RvciwgW251bGxdLmNvbmNhdChhcmdzWzBdKSkpO1xuICAgIH07XG4gICAgT2JqZWN0U3BhY2UucHJvdG90eXBlLl9hY3F1aXJlUmVtb3RlT2JqZWN0VGFnID0gZnVuY3Rpb24gKGNsYXNzTmFtZSwgb2JqZWN0SWQpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9vYmplY3RJZHNbY2xhc3NOYW1lXSkge1xuICAgICAgICAgICAgdGhpcy5fb2JqZWN0SWRzW2NsYXNzTmFtZV0gPSAwO1xuICAgICAgICB9XG4gICAgICAgIGlmICghb2JqZWN0SWQpIHtcbiAgICAgICAgICAgIG9iamVjdElkID0gdGhpcy5fb2JqZWN0SWRzW2NsYXNzTmFtZV0gKyAxO1xuICAgICAgICAgICAgaWYgKCFvYmplY3RJZCkge1xuICAgICAgICAgICAgICAgIG9iamVjdElkID0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAob2JqZWN0SWQgPD0gdGhpcy5fb2JqZWN0SWRzW2NsYXNzTmFtZV0pIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJpbnZhbGlkIG9iamVjdElkIHdhcyBzcGVjaWZpZWQ6IFwiICsgb2JqZWN0SWQpO1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fb2JqZWN0SWRzW2NsYXNzTmFtZV0gPSBvYmplY3RJZDtcbiAgICAgICAgcmV0dXJuIGNsYXNzTmFtZSArIFwiOlwiICsgb2JqZWN0SWQ7XG4gICAgfTtcbiAgICByZXR1cm4gT2JqZWN0U3BhY2U7XG59KCkpO1xuZXhwb3J0cy5PYmplY3RTcGFjZSA9IE9iamVjdFNwYWNlO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgT2JqZWN0U3BhY2VGQyA9IChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gT2JqZWN0U3BhY2VGQyhmdW5jdGlvbkNoYW5uZWwsIG9iamVjdFNwYWNlKSB7XG4gICAgICAgIHRoaXMuX2Z1bmN0aW9uQ2hhbm5lbCA9IGZ1bmN0aW9uQ2hhbm5lbDtcbiAgICAgICAgdGhpcy5fb2JqZWN0U3BhY2UgPSBvYmplY3RTcGFjZTtcbiAgICB9XG4gICAgT2JqZWN0U3BhY2VGQy5wcm90b3R5cGUuY3JlYXRlID0gZnVuY3Rpb24gKGNsYXNzTmFtZSkge1xuICAgICAgICB2YXIgYXJncyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBfaSA9IDE7IF9pIDwgYXJndW1lbnRzLmxlbmd0aDsgX2krKykge1xuICAgICAgICAgICAgYXJnc1tfaSAtIDFdID0gYXJndW1lbnRzW19pXTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgb2JqZWN0VGFnID0gdGhpcy5fb2JqZWN0U3BhY2UuY3JlYXRlKGNsYXNzTmFtZSwgYXJncyk7XG4gICAgICAgIGlmICghb2JqZWN0VGFnKVxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgdmFyIGxvY2FsT2JqZWN0ID0gdGhpcy5fb2JqZWN0U3BhY2UuZ2V0T2JqZWN0KG9iamVjdFRhZyk7XG4gICAgICAgIHRoaXMuX2Z1bmN0aW9uQ2hhbm5lbC5iaW5kKG9iamVjdFRhZywgbG9jYWxPYmplY3QpO1xuICAgICAgICByZXR1cm4gb2JqZWN0VGFnO1xuICAgIH07XG4gICAgT2JqZWN0U3BhY2VGQy5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uIChvYmplY3QpIHtcbiAgICAgICAgdGhpcy5fb2JqZWN0U3BhY2UuZGVzdHJveShvYmplY3QpO1xuICAgIH07XG4gICAgcmV0dXJuIE9iamVjdFNwYWNlRkM7XG59KCkpO1xuZXhwb3J0cy5PYmplY3RTcGFjZUZDID0gT2JqZWN0U3BhY2VGQztcbiIsIlwidXNlIHN0cmljdFwiO1xuLyoqXG4gKiBlcnJvci10eXBlIG9mIG9iamVjdCBjaGFubmVsXG4gKi9cbnZhciBFUlJPUl9UWVBFX0NMT1NFID0gJ0Nsb3NlJztcbnZhciBSZW1vdGVPYmplY3QgPSAoZnVuY3Rpb24gKCkge1xuICAgIGZ1bmN0aW9uIFJlbW90ZU9iamVjdChjaGFubmVsLCBzcGFjZSwgdGFnKSB7XG4gICAgICAgIHRoaXMuX2NoYW5uZWwgPSBjaGFubmVsO1xuICAgICAgICB0aGlzLl9zcGFjZSA9IHNwYWNlO1xuICAgICAgICB0aGlzLl90YWcgPSB0YWc7XG4gICAgICAgIHRoaXMuX2Rlc3Ryb3llZCA9IGZhbHNlO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBOYXRpdmXlgbTjga7jg6Hjgr3jg4Pjg4njgpLlrp/ooYxcbiAgICAgKlxuICAgICAqIEBwYXJhbSBtZXRob2Qg5a6f6KGM44GZ44KL44Oh44K944OD44OJ5ZCNXG4gICAgICogQHBhcmFtIFthcmdzXSDlrp/ooYzjgZnjgovjg6Hjgr3jg4Pjg4njgavmuKHjgZnlvJXmlbBcbiAgICAgKiBAcGFyYW0gW2NhbGxiYWNrXSDntZDmnpzjgpLlj5fjgZHlj5bjgovjgrPjg7zjg6vjg5Djg4Pjgq9cbiAgICAgKiBAcGFyYW0gW3RpbWVvdXRdIOW/nOetlOW+heOBoeOBruOCv+OCpOODoOOCouOCpuODiFxuICAgICAqIEByZXR1cm4g44Oh44K944OD44OJ44Gu5oi744KK5YCkXG4gICAgICovXG4gICAgUmVtb3RlT2JqZWN0LnByb3RvdHlwZS5pbnZva2UgPSBmdW5jdGlvbiAobWV0aG9kLCBhcmdzLCBjYWxsYmFjaywgdGltZW91dCkge1xuICAgICAgICBpZiAodGhpcy5fZGVzdHJveWVkKSB7XG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spXG4gICAgICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkodGhpcywgW1wiQWxyZWFkeURlc3Ryb3llZFwiXSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fY2hhbm5lbC5pbnZva2UodGhpcy5fdGFnLCBtZXRob2QsIGFyZ3MsIGNhbGxiYWNrLCB0aW1lb3V0KTtcbiAgICB9O1xuICAgIC8qKlxuICAgICAqIE5hdGl2ZeWBtOOBruOCquODluOCuOOCp+OCr+ODiOOCkuegtOajhFxuICAgICAqL1xuICAgIFJlbW90ZU9iamVjdC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Rlc3Ryb3llZCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2NoYW5uZWwuaW52b2tlKFwiJG9ialwiLCBcImRlc3Ryb3lcIiwgW3RoaXMuX3RhZ10pO1xuICAgICAgICB0aGlzLl9kZXN0cm95ZWQgPSB0cnVlO1xuICAgIH07XG4gICAgcmV0dXJuIFJlbW90ZU9iamVjdDtcbn0oKSk7XG5leHBvcnRzLlJlbW90ZU9iamVjdCA9IFJlbW90ZU9iamVjdDtcbiIsIlwidXNlIHN0cmljdFwiO1xudmFyIE9iamVjdENoYW5uZWxfMSA9IHJlcXVpcmUoJy4vT2JqZWN0Q2hhbm5lbCcpO1xuZXhwb3J0cy5PYmplY3RDaGFubmVsID0gT2JqZWN0Q2hhbm5lbF8xLk9iamVjdENoYW5uZWw7XG52YXIgT2JqZWN0U3BhY2VfMSA9IHJlcXVpcmUoJy4vT2JqZWN0U3BhY2UnKTtcbmV4cG9ydHMuT2JqZWN0U3BhY2UgPSBPYmplY3RTcGFjZV8xLk9iamVjdFNwYWNlO1xudmFyIFJlbW90ZU9iamVjdF8xID0gcmVxdWlyZSgnLi9SZW1vdGVPYmplY3QnKTtcbmV4cG9ydHMuUmVtb3RlT2JqZWN0ID0gUmVtb3RlT2JqZWN0XzEuUmVtb3RlT2JqZWN0O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgT2JqZWN0Q2hhbm5lbFdyYXBwZXJfMSA9IHJlcXVpcmUoJy4vT2JqZWN0Q2hhbm5lbFdyYXBwZXInKTtcbmV4cG9ydHMuT2JqZWN0Q2hhbm5lbFdyYXBwZXIgPSBPYmplY3RDaGFubmVsV3JhcHBlcl8xLk9iamVjdENoYW5uZWxXcmFwcGVyO1xuIl19
