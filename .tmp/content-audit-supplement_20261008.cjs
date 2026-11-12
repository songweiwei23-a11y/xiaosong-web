"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/next/dist/compiled/@edge-runtime/cookies/index.js
var require_cookies = __commonJS({
  "node_modules/next/dist/compiled/@edge-runtime/cookies/index.js"(exports2, module2) {
    "use strict";
    var __defProp2 = Object.defineProperty;
    var __getOwnPropDesc2 = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames2 = Object.getOwnPropertyNames;
    var __hasOwnProp2 = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp2(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps2 = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames2(from))
          if (!__hasOwnProp2.call(to, key) && key !== except)
            __defProp2(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc2(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toCommonJS = (mod) => __copyProps2(__defProp2({}, "__esModule", { value: true }), mod);
    var src_exports = {};
    __export(src_exports, {
      RequestCookies: () => RequestCookies,
      ResponseCookies: () => ResponseCookies,
      parseCookie: () => parseCookie,
      parseSetCookie: () => parseSetCookie,
      stringifyCookie: () => stringifyCookie
    });
    module2.exports = __toCommonJS(src_exports);
    function stringifyCookie(c) {
      var _a;
      const attrs = [
        "path" in c && c.path && `Path=${c.path}`,
        "expires" in c && (c.expires || c.expires === 0) && `Expires=${(typeof c.expires === "number" ? new Date(c.expires) : c.expires).toUTCString()}`,
        "maxAge" in c && typeof c.maxAge === "number" && `Max-Age=${c.maxAge}`,
        "domain" in c && c.domain && `Domain=${c.domain}`,
        "secure" in c && c.secure && "Secure",
        "httpOnly" in c && c.httpOnly && "HttpOnly",
        "sameSite" in c && c.sameSite && `SameSite=${c.sameSite}`,
        "partitioned" in c && c.partitioned && "Partitioned",
        "priority" in c && c.priority && `Priority=${c.priority}`
      ].filter(Boolean);
      const stringified = `${c.name}=${encodeURIComponent((_a = c.value) != null ? _a : "")}`;
      return attrs.length === 0 ? stringified : `${stringified}; ${attrs.join("; ")}`;
    }
    function parseCookie(cookie) {
      const map = /* @__PURE__ */ new Map();
      for (const pair of cookie.split(/; */)) {
        if (!pair)
          continue;
        const splitAt = pair.indexOf("=");
        if (splitAt === -1) {
          map.set(pair, "true");
          continue;
        }
        const [key, value] = [pair.slice(0, splitAt), pair.slice(splitAt + 1)];
        try {
          map.set(key, decodeURIComponent(value != null ? value : "true"));
        } catch {
        }
      }
      return map;
    }
    function parseSetCookie(setCookie) {
      if (!setCookie) {
        return void 0;
      }
      const [[name, value], ...attributes] = parseCookie(setCookie);
      const {
        domain,
        expires,
        httponly,
        maxage,
        path,
        samesite,
        secure,
        partitioned,
        priority
      } = Object.fromEntries(
        attributes.map(([key, value2]) => [
          key.toLowerCase().replace(/-/g, ""),
          value2
        ])
      );
      const cookie = {
        name,
        value: decodeURIComponent(value),
        domain,
        ...expires && { expires: new Date(expires) },
        ...httponly && { httpOnly: true },
        ...typeof maxage === "string" && { maxAge: Number(maxage) },
        path,
        ...samesite && { sameSite: parseSameSite(samesite) },
        ...secure && { secure: true },
        ...priority && { priority: parsePriority(priority) },
        ...partitioned && { partitioned: true }
      };
      return compact(cookie);
    }
    function compact(t) {
      const newT = {};
      for (const key in t) {
        if (t[key]) {
          newT[key] = t[key];
        }
      }
      return newT;
    }
    var SAME_SITE = ["strict", "lax", "none"];
    function parseSameSite(string) {
      string = string.toLowerCase();
      return SAME_SITE.includes(string) ? string : void 0;
    }
    var PRIORITY = ["low", "medium", "high"];
    function parsePriority(string) {
      string = string.toLowerCase();
      return PRIORITY.includes(string) ? string : void 0;
    }
    function splitCookiesString(cookiesString) {
      if (!cookiesString)
        return [];
      var cookiesStrings = [];
      var pos = 0;
      var start;
      var ch;
      var lastComma;
      var nextStart;
      var cookiesSeparatorFound;
      function skipWhitespace() {
        while (pos < cookiesString.length && /\s/.test(cookiesString.charAt(pos))) {
          pos += 1;
        }
        return pos < cookiesString.length;
      }
      function notSpecialChar() {
        ch = cookiesString.charAt(pos);
        return ch !== "=" && ch !== ";" && ch !== ",";
      }
      while (pos < cookiesString.length) {
        start = pos;
        cookiesSeparatorFound = false;
        while (skipWhitespace()) {
          ch = cookiesString.charAt(pos);
          if (ch === ",") {
            lastComma = pos;
            pos += 1;
            skipWhitespace();
            nextStart = pos;
            while (pos < cookiesString.length && notSpecialChar()) {
              pos += 1;
            }
            if (pos < cookiesString.length && cookiesString.charAt(pos) === "=") {
              cookiesSeparatorFound = true;
              pos = nextStart;
              cookiesStrings.push(cookiesString.substring(start, lastComma));
              start = pos;
            } else {
              pos = lastComma + 1;
            }
          } else {
            pos += 1;
          }
        }
        if (!cookiesSeparatorFound || pos >= cookiesString.length) {
          cookiesStrings.push(cookiesString.substring(start, cookiesString.length));
        }
      }
      return cookiesStrings;
    }
    var RequestCookies = class {
      constructor(requestHeaders) {
        this._parsed = /* @__PURE__ */ new Map();
        this._headers = requestHeaders;
        const header = requestHeaders.get("cookie");
        if (header) {
          const parsed = parseCookie(header);
          for (const [name, value] of parsed) {
            this._parsed.set(name, { name, value });
          }
        }
      }
      [Symbol.iterator]() {
        return this._parsed[Symbol.iterator]();
      }
      /**
       * The amount of cookies received from the client
       */
      get size() {
        return this._parsed.size;
      }
      get(...args) {
        const name = typeof args[0] === "string" ? args[0] : args[0].name;
        return this._parsed.get(name);
      }
      getAll(...args) {
        var _a;
        const all = Array.from(this._parsed);
        if (!args.length) {
          return all.map(([_, value]) => value);
        }
        const name = typeof args[0] === "string" ? args[0] : (_a = args[0]) == null ? void 0 : _a.name;
        return all.filter(([n]) => n === name).map(([_, value]) => value);
      }
      has(name) {
        return this._parsed.has(name);
      }
      set(...args) {
        const [name, value] = args.length === 1 ? [args[0].name, args[0].value] : args;
        const map = this._parsed;
        map.set(name, { name, value });
        this._headers.set(
          "cookie",
          Array.from(map).map(([_, value2]) => stringifyCookie(value2)).join("; ")
        );
        return this;
      }
      /**
       * Delete the cookies matching the passed name or names in the request.
       */
      delete(names) {
        const map = this._parsed;
        const result = !Array.isArray(names) ? map.delete(names) : names.map((name) => map.delete(name));
        this._headers.set(
          "cookie",
          Array.from(map).map(([_, value]) => stringifyCookie(value)).join("; ")
        );
        return result;
      }
      /**
       * Delete all the cookies in the cookies in the request.
       */
      clear() {
        this.delete(Array.from(this._parsed.keys()));
        return this;
      }
      /**
       * Format the cookies in the request as a string for logging
       */
      [Symbol.for("edge-runtime.inspect.custom")]() {
        return `RequestCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`;
      }
      toString() {
        return [...this._parsed.values()].map((v) => `${v.name}=${encodeURIComponent(v.value)}`).join("; ");
      }
    };
    var ResponseCookies = class {
      constructor(responseHeaders) {
        this._parsed = /* @__PURE__ */ new Map();
        var _a, _b, _c;
        this._headers = responseHeaders;
        const setCookie = (_c = (_b = (_a = responseHeaders.getSetCookie) == null ? void 0 : _a.call(responseHeaders)) != null ? _b : responseHeaders.get("set-cookie")) != null ? _c : [];
        const cookieStrings = Array.isArray(setCookie) ? setCookie : splitCookiesString(setCookie);
        for (const cookieString of cookieStrings) {
          const parsed = parseSetCookie(cookieString);
          if (parsed)
            this._parsed.set(parsed.name, parsed);
        }
      }
      /**
       * {@link https://wicg.github.io/cookie-store/#CookieStore-get CookieStore#get} without the Promise.
       */
      get(...args) {
        const key = typeof args[0] === "string" ? args[0] : args[0].name;
        return this._parsed.get(key);
      }
      /**
       * {@link https://wicg.github.io/cookie-store/#CookieStore-getAll CookieStore#getAll} without the Promise.
       */
      getAll(...args) {
        var _a;
        const all = Array.from(this._parsed.values());
        if (!args.length) {
          return all;
        }
        const key = typeof args[0] === "string" ? args[0] : (_a = args[0]) == null ? void 0 : _a.name;
        return all.filter((c) => c.name === key);
      }
      has(name) {
        return this._parsed.has(name);
      }
      /**
       * {@link https://wicg.github.io/cookie-store/#CookieStore-set CookieStore#set} without the Promise.
       */
      set(...args) {
        const [name, value, cookie] = args.length === 1 ? [args[0].name, args[0].value, args[0]] : args;
        const map = this._parsed;
        map.set(name, normalizeCookie({ name, value, ...cookie }));
        replace(map, this._headers);
        return this;
      }
      /**
       * {@link https://wicg.github.io/cookie-store/#CookieStore-delete CookieStore#delete} without the Promise.
       */
      delete(...args) {
        const [name, options] = typeof args[0] === "string" ? [args[0]] : [args[0].name, args[0]];
        return this.set({ ...options, name, value: "", expires: /* @__PURE__ */ new Date(0) });
      }
      [Symbol.for("edge-runtime.inspect.custom")]() {
        return `ResponseCookies ${JSON.stringify(Object.fromEntries(this._parsed))}`;
      }
      toString() {
        return [...this._parsed.values()].map(stringifyCookie).join("; ");
      }
    };
    function replace(bag, headers) {
      headers.delete("set-cookie");
      for (const [, value] of bag) {
        const serialized = stringifyCookie(value);
        headers.append("set-cookie", serialized);
      }
    }
    function normalizeCookie(cookie = { name: "", value: "" }) {
      if (typeof cookie.expires === "number") {
        cookie.expires = new Date(cookie.expires);
      }
      if (cookie.maxAge) {
        cookie.expires = new Date(Date.now() + cookie.maxAge * 1e3);
      }
      if (cookie.path === null || cookie.path === void 0) {
        cookie.path = "/";
      }
      return cookie;
    }
  }
});

// node_modules/next/dist/server/web/spec-extension/cookies.js
var require_cookies2 = __commonJS({
  "node_modules/next/dist/server/web/spec-extension/cookies.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    _export(exports2, {
      RequestCookies: function() {
        return _cookies.RequestCookies;
      },
      ResponseCookies: function() {
        return _cookies.ResponseCookies;
      },
      stringifyCookie: function() {
        return _cookies.stringifyCookie;
      }
    });
    var _cookies = require_cookies();
  }
});

// node_modules/next/dist/server/web/spec-extension/adapters/reflect.js
var require_reflect = __commonJS({
  "node_modules/next/dist/server/web/spec-extension/adapters/reflect.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    Object.defineProperty(exports2, "ReflectAdapter", {
      enumerable: true,
      get: function() {
        return ReflectAdapter;
      }
    });
    var ReflectAdapter = class {
      static get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === "function") {
          return value.bind(target);
        }
        return value;
      }
      static set(target, prop, value, receiver) {
        return Reflect.set(target, prop, value, receiver);
      }
      static has(target, prop) {
        return Reflect.has(target, prop);
      }
      static deleteProperty(target, prop) {
        return Reflect.deleteProperty(target, prop);
      }
    };
  }
});

// node_modules/next/dist/server/app-render/async-local-storage.js
var require_async_local_storage = __commonJS({
  "node_modules/next/dist/server/app-render/async-local-storage.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    _export(exports2, {
      bindSnapshot: function() {
        return bindSnapshot;
      },
      createAsyncLocalStorage: function() {
        return createAsyncLocalStorage;
      },
      createSnapshot: function() {
        return createSnapshot;
      }
    });
    var sharedAsyncLocalStorageNotAvailableError = Object.defineProperty(new Error("Invariant: AsyncLocalStorage accessed in runtime where it is not available"), "__NEXT_ERROR_CODE", {
      value: "E504",
      enumerable: false,
      configurable: true
    });
    var FakeAsyncLocalStorage = class {
      disable() {
        throw sharedAsyncLocalStorageNotAvailableError;
      }
      getStore() {
        return void 0;
      }
      run() {
        throw sharedAsyncLocalStorageNotAvailableError;
      }
      exit() {
        throw sharedAsyncLocalStorageNotAvailableError;
      }
      enterWith() {
        throw sharedAsyncLocalStorageNotAvailableError;
      }
      static bind(fn) {
        return fn;
      }
    };
    var maybeGlobalAsyncLocalStorage = typeof globalThis !== "undefined" && globalThis.AsyncLocalStorage;
    function createAsyncLocalStorage() {
      if (maybeGlobalAsyncLocalStorage) {
        return new maybeGlobalAsyncLocalStorage();
      }
      return new FakeAsyncLocalStorage();
    }
    function bindSnapshot(fn) {
      if (maybeGlobalAsyncLocalStorage) {
        return maybeGlobalAsyncLocalStorage.bind(fn);
      }
      return FakeAsyncLocalStorage.bind(fn);
    }
    function createSnapshot() {
      if (maybeGlobalAsyncLocalStorage) {
        return maybeGlobalAsyncLocalStorage.snapshot();
      }
      return function(fn, ...args) {
        return fn(...args);
      };
    }
  }
});

// node_modules/next/dist/server/app-render/work-async-storage-instance.js
var require_work_async_storage_instance = __commonJS({
  "node_modules/next/dist/server/app-render/work-async-storage-instance.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    Object.defineProperty(exports2, "workAsyncStorageInstance", {
      enumerable: true,
      get: function() {
        return workAsyncStorageInstance;
      }
    });
    var _asynclocalstorage = require_async_local_storage();
    var workAsyncStorageInstance = (0, _asynclocalstorage.createAsyncLocalStorage)();
  }
});

// node_modules/next/dist/server/app-render/work-async-storage.external.js
var require_work_async_storage_external = __commonJS({
  "node_modules/next/dist/server/app-render/work-async-storage.external.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    Object.defineProperty(exports2, "workAsyncStorage", {
      enumerable: true,
      get: function() {
        return _workasyncstorageinstance.workAsyncStorageInstance;
      }
    });
    var _workasyncstorageinstance = require_work_async_storage_instance();
  }
});

// node_modules/next/dist/shared/lib/action-revalidation-kind.js
var require_action_revalidation_kind = __commonJS({
  "node_modules/next/dist/shared/lib/action-revalidation-kind.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    _export(exports2, {
      ActionDidNotRevalidate: function() {
        return ActionDidNotRevalidate;
      },
      ActionDidRevalidateDynamicOnly: function() {
        return ActionDidRevalidateDynamicOnly;
      },
      ActionDidRevalidateStaticAndDynamic: function() {
        return ActionDidRevalidateStaticAndDynamic;
      }
    });
    var ActionDidNotRevalidate = 0;
    var ActionDidRevalidateStaticAndDynamic = 1;
    var ActionDidRevalidateDynamicOnly = 2;
  }
});

// node_modules/next/dist/server/web/spec-extension/adapters/request-cookies.js
var require_request_cookies = __commonJS({
  "node_modules/next/dist/server/web/spec-extension/adapters/request-cookies.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    _export(exports2, {
      MutableRequestCookiesAdapter: function() {
        return MutableRequestCookiesAdapter;
      },
      ReadonlyRequestCookiesError: function() {
        return ReadonlyRequestCookiesError;
      },
      RequestCookiesAdapter: function() {
        return RequestCookiesAdapter;
      },
      appendMutableCookies: function() {
        return appendMutableCookies;
      },
      areCookiesMutableInCurrentPhase: function() {
        return areCookiesMutableInCurrentPhase;
      },
      createCookiesWithMutableAccessCheck: function() {
        return createCookiesWithMutableAccessCheck;
      },
      getModifiedCookieValues: function() {
        return getModifiedCookieValues;
      },
      responseCookiesToRequestCookies: function() {
        return responseCookiesToRequestCookies;
      }
    });
    var _cookies = require_cookies2();
    var _reflect = require_reflect();
    var _workasyncstorageexternal = require_work_async_storage_external();
    var _actionrevalidationkind = require_action_revalidation_kind();
    var ReadonlyRequestCookiesError = class _ReadonlyRequestCookiesError extends Error {
      constructor() {
        super("Cookies can only be modified in a Server Action or Route Handler. Read more: https://nextjs.org/docs/app/api-reference/functions/cookies#options");
        Object.defineProperty(this, "__NEXT_ERROR_CODE", {
          value: "E1180",
          enumerable: false,
          configurable: true
        });
      }
      static callable() {
        throw new _ReadonlyRequestCookiesError();
      }
    };
    var RequestCookiesAdapter = class {
      static seal(cookies2) {
        return new Proxy(cookies2, {
          get(target, prop, receiver) {
            switch (prop) {
              case "clear":
              case "delete":
              case "set":
                return ReadonlyRequestCookiesError.callable;
              default:
                return _reflect.ReflectAdapter.get(target, prop, receiver);
            }
          }
        });
      }
      /**
      * @param cookies
      * @returns A fresh object identity backed by the original value
      */
      static fresh(cookies2) {
        return new Proxy(cookies2, {
          get(target, prop, receiver) {
            return _reflect.ReflectAdapter.get(target, prop, receiver);
          }
        });
      }
    };
    var SYMBOL_MODIFY_COOKIE_VALUES = Symbol.for("next.mutated.cookies");
    function getModifiedCookieValues(cookies2) {
      const modified = cookies2[SYMBOL_MODIFY_COOKIE_VALUES];
      if (!modified || !Array.isArray(modified) || modified.length === 0) {
        return [];
      }
      return modified;
    }
    function appendMutableCookies(headers, mutableCookies) {
      const modifiedCookieValues = getModifiedCookieValues(mutableCookies);
      if (modifiedCookieValues.length === 0) {
        return false;
      }
      const resCookies = new _cookies.ResponseCookies(headers);
      const returnedCookies = resCookies.getAll();
      for (const cookie of modifiedCookieValues) {
        resCookies.set(cookie);
      }
      for (const cookie of returnedCookies) {
        resCookies.set(cookie);
      }
      return true;
    }
    var MutableRequestCookiesAdapter = class {
      static wrap(cookies2, onUpdateCookies) {
        const responseCookies = new _cookies.ResponseCookies(new Headers());
        for (const cookie of cookies2.getAll()) {
          responseCookies.set(cookie);
        }
        let modifiedValues = [];
        const modifiedCookies = /* @__PURE__ */ new Set();
        const updateResponseCookies = () => {
          const workStore = _workasyncstorageexternal.workAsyncStorage.getStore();
          if (workStore) {
            workStore.pathWasRevalidated = _actionrevalidationkind.ActionDidRevalidateStaticAndDynamic;
          }
          const allCookies = responseCookies.getAll();
          modifiedValues = allCookies.filter((c) => modifiedCookies.has(c.name));
          if (onUpdateCookies) {
            const serializedCookies = [];
            for (const cookie of modifiedValues) {
              const tempCookies = new _cookies.ResponseCookies(new Headers());
              tempCookies.set(cookie);
              serializedCookies.push(tempCookies.toString());
            }
            onUpdateCookies(serializedCookies);
          }
        };
        const wrappedCookies = new Proxy(responseCookies, {
          get(target, prop, receiver) {
            switch (prop) {
              case SYMBOL_MODIFY_COOKIE_VALUES:
                return modifiedValues;
              case "delete":
                return function(...args) {
                  modifiedCookies.add(typeof args[0] === "string" ? args[0] : args[0].name);
                  try {
                    target.delete(...args);
                    return wrappedCookies;
                  } finally {
                    updateResponseCookies();
                  }
                };
              case "set":
                return function(...args) {
                  modifiedCookies.add(typeof args[0] === "string" ? args[0] : args[0].name);
                  try {
                    target.set(...args);
                    return wrappedCookies;
                  } finally {
                    updateResponseCookies();
                  }
                };
              default:
                return _reflect.ReflectAdapter.get(target, prop, receiver);
            }
          }
        });
        return wrappedCookies;
      }
    };
    function createCookiesWithMutableAccessCheck(requestStore) {
      const wrappedCookies = new Proxy(requestStore.mutableCookies, {
        get(target, prop, receiver) {
          switch (prop) {
            case "delete":
              return function(...args) {
                ensureCookiesAreStillMutable(requestStore, "cookies().delete");
                target.delete(...args);
                return wrappedCookies;
              };
            case "set":
              return function(...args) {
                ensureCookiesAreStillMutable(requestStore, "cookies().set");
                target.set(...args);
                return wrappedCookies;
              };
            default:
              return _reflect.ReflectAdapter.get(target, prop, receiver);
          }
        }
      });
      return wrappedCookies;
    }
    function areCookiesMutableInCurrentPhase(requestStore) {
      return requestStore.phase === "action";
    }
    function ensureCookiesAreStillMutable(requestStore, _callingExpression) {
      if (!areCookiesMutableInCurrentPhase(requestStore)) {
        throw new ReadonlyRequestCookiesError();
      }
    }
    function responseCookiesToRequestCookies(responseCookies) {
      const requestCookies = new _cookies.RequestCookies(new Headers());
      for (const cookie of responseCookies.getAll()) {
        requestCookies.set(cookie);
      }
      return requestCookies;
    }
  }
});

// node_modules/next/dist/server/app-render/work-unit-async-storage-instance.js
var require_work_unit_async_storage_instance = __commonJS({
  "node_modules/next/dist/server/app-render/work-unit-async-storage-instance.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    Object.defineProperty(exports2, "workUnitAsyncStorageInstance", {
      enumerable: true,
      get: function() {
        return workUnitAsyncStorageInstance;
      }
    });
    var _asynclocalstorage = require_async_local_storage();
    var workUnitAsyncStorageInstance = (0, _asynclocalstorage.createAsyncLocalStorage)();
  }
});

// node_modules/next/dist/shared/lib/invariant-error.js
var require_invariant_error = __commonJS({
  "node_modules/next/dist/shared/lib/invariant-error.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    Object.defineProperty(exports2, "InvariantError", {
      enumerable: true,
      get: function() {
        return InvariantError;
      }
    });
    var InvariantError = class extends Error {
      constructor(message, options) {
        super(`Invariant: ${message.endsWith(".") ? message : message + "."} This is a bug in Next.js.`, options);
        Object.defineProperty(this, "__NEXT_ERROR_CODE", {
          value: "E1179",
          enumerable: false,
          configurable: true
        });
        this.name = "InvariantError";
      }
    };
  }
});

// node_modules/next/dist/server/app-render/work-unit-async-storage.external.js
var require_work_unit_async_storage_external = __commonJS({
  "node_modules/next/dist/server/app-render/work-unit-async-storage.external.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    _export(exports2, {
      getCacheSignal: function() {
        return getCacheSignal;
      },
      getDraftModeProviderForCacheScope: function() {
        return getDraftModeProviderForCacheScope;
      },
      getHmrRefreshHash: function() {
        return getHmrRefreshHash;
      },
      getResumeDataCache: function() {
        return getResumeDataCache;
      },
      getServerComponentsHmrCache: function() {
        return getServerComponentsHmrCache;
      },
      getStagedRenderingController: function() {
        return getStagedRenderingController;
      },
      getVaryParamsAccumulator: function() {
        return getVaryParamsAccumulator;
      },
      isHmrRefresh: function() {
        return isHmrRefresh;
      },
      throwForMissingRequestStore: function() {
        return throwForMissingRequestStore;
      },
      throwInvariantForMissingStore: function() {
        return throwInvariantForMissingStore;
      },
      workUnitAsyncStorage: function() {
        return _workunitasyncstorageinstance.workUnitAsyncStorageInstance;
      }
    });
    var _workunitasyncstorageinstance = require_work_unit_async_storage_instance();
    var _invarianterror = require_invariant_error();
    function throwForMissingRequestStore(callingExpression) {
      throw Object.defineProperty(new Error(`\`${callingExpression}\` was called outside a request scope. Read more: https://nextjs.org/docs/messages/next-dynamic-api-wrong-context`), "__NEXT_ERROR_CODE", {
        value: "E251",
        enumerable: false,
        configurable: true
      });
    }
    function throwInvariantForMissingStore() {
      throw Object.defineProperty(new _invarianterror.InvariantError("Expected workUnitAsyncStorage to have a store."), "__NEXT_ERROR_CODE", {
        value: "E696",
        enumerable: false,
        configurable: true
      });
    }
    function getResumeDataCache(workUnitStore) {
      switch (workUnitStore.type) {
        case "request":
        case "prerender":
        case "prerender-runtime":
        case "prerender-client":
        case "validation-client":
        case "prerender-ppr":
          return workUnitStore.resumeDataCache;
        case "cache":
        case "private-cache":
        case "unstable-cache":
        case "prerender-legacy":
        case "generate-static-params":
          return null;
        default:
          return workUnitStore;
      }
    }
    function getHmrRefreshHash(workUnitStore) {
      if (process.env.__NEXT_DEV_SERVER) {
        switch (workUnitStore.type) {
          case "cache":
          case "private-cache":
          case "prerender":
          case "prerender-runtime":
          case "request":
            return workUnitStore.hmrRefreshHash;
          case "prerender-client":
          case "validation-client":
          case "prerender-ppr":
          case "prerender-legacy":
          case "unstable-cache":
          case "generate-static-params":
            break;
          default:
            workUnitStore;
        }
      }
      return void 0;
    }
    function isHmrRefresh(workUnitStore) {
      if (process.env.__NEXT_DEV_SERVER) {
        switch (workUnitStore.type) {
          case "cache":
          case "private-cache":
          case "request":
            return workUnitStore.isHmrRefresh ?? false;
          case "prerender":
          case "prerender-client":
          case "validation-client":
          case "prerender-runtime":
          case "prerender-ppr":
          case "prerender-legacy":
          case "unstable-cache":
          case "generate-static-params":
            break;
          default:
            workUnitStore;
        }
      }
      return false;
    }
    function getServerComponentsHmrCache(workUnitStore) {
      if (process.env.__NEXT_DEV_SERVER) {
        switch (workUnitStore.type) {
          case "cache":
          case "private-cache":
          case "request":
            return workUnitStore.serverComponentsHmrCache;
          case "prerender":
          case "prerender-client":
          case "validation-client":
          case "prerender-runtime":
          case "prerender-ppr":
          case "prerender-legacy":
          case "unstable-cache":
          case "generate-static-params":
            break;
          default:
            workUnitStore;
        }
      }
      return void 0;
    }
    function getDraftModeProviderForCacheScope(workStore, workUnitStore) {
      if (workStore.isDraftMode) {
        switch (workUnitStore.type) {
          case "cache":
          case "private-cache":
          case "unstable-cache":
          case "prerender-runtime":
          case "request":
            return workUnitStore.draftMode;
          case "prerender":
          case "prerender-client":
          case "validation-client":
          case "prerender-ppr":
          case "prerender-legacy":
          case "generate-static-params":
            break;
          default:
            workUnitStore;
        }
      }
      return void 0;
    }
    function getStagedRenderingController(workUnitStore) {
      switch (workUnitStore.type) {
        case "request":
        case "prerender-runtime":
        case "prerender":
          return workUnitStore.stagedRendering ?? null;
        case "prerender-client":
        case "validation-client":
        case "prerender-ppr":
        case "prerender-legacy":
        case "cache":
        case "private-cache":
        case "unstable-cache":
        case "generate-static-params":
          return null;
        default:
          return workUnitStore;
      }
    }
    function getCacheSignal(workUnitStore) {
      switch (workUnitStore.type) {
        case "prerender":
        case "prerender-client":
        case "validation-client":
        case "prerender-runtime":
          return workUnitStore.cacheSignal;
        case "request": {
          if (workUnitStore.cacheSignal) {
            return workUnitStore.cacheSignal;
          }
        }
        case "prerender-ppr":
        case "prerender-legacy":
        case "cache":
        case "private-cache":
        case "unstable-cache":
        case "generate-static-params":
          return null;
        default:
          return workUnitStore;
      }
    }
    function getVaryParamsAccumulator(workUnitStore) {
      switch (workUnitStore.type) {
        case "prerender":
        case "prerender-runtime":
        case "request": {
          return workUnitStore.varyParamsAccumulator ?? null;
        }
        case "prerender-ppr":
        case "prerender-legacy":
        case "cache":
        case "private-cache":
        case "prerender-client":
        case "validation-client":
        case "unstable-cache":
        case "generate-static-params":
          return null;
        default:
          workUnitStore;
          return null;
      }
    }
  }
});

// node_modules/react/cjs/react.production.min.js
var require_react_production_min = __commonJS({
  "node_modules/react/cjs/react.production.min.js"(exports2) {
    "use strict";
    var l = Symbol.for("react.element");
    var n = Symbol.for("react.portal");
    var p = Symbol.for("react.fragment");
    var q = Symbol.for("react.strict_mode");
    var r = Symbol.for("react.profiler");
    var t = Symbol.for("react.provider");
    var u = Symbol.for("react.context");
    var v = Symbol.for("react.forward_ref");
    var w = Symbol.for("react.suspense");
    var x = Symbol.for("react.memo");
    var y = Symbol.for("react.lazy");
    var z = Symbol.iterator;
    function A(a) {
      if (null === a || "object" !== typeof a) return null;
      a = z && a[z] || a["@@iterator"];
      return "function" === typeof a ? a : null;
    }
    var B = { isMounted: function() {
      return false;
    }, enqueueForceUpdate: function() {
    }, enqueueReplaceState: function() {
    }, enqueueSetState: function() {
    } };
    var C = Object.assign;
    var D = {};
    function E(a, b, e) {
      this.props = a;
      this.context = b;
      this.refs = D;
      this.updater = e || B;
    }
    E.prototype.isReactComponent = {};
    E.prototype.setState = function(a, b) {
      if ("object" !== typeof a && "function" !== typeof a && null != a) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
      this.updater.enqueueSetState(this, a, b, "setState");
    };
    E.prototype.forceUpdate = function(a) {
      this.updater.enqueueForceUpdate(this, a, "forceUpdate");
    };
    function F() {
    }
    F.prototype = E.prototype;
    function G(a, b, e) {
      this.props = a;
      this.context = b;
      this.refs = D;
      this.updater = e || B;
    }
    var H = G.prototype = new F();
    H.constructor = G;
    C(H, E.prototype);
    H.isPureReactComponent = true;
    var I = Array.isArray;
    var J = Object.prototype.hasOwnProperty;
    var K = { current: null };
    var L = { key: true, ref: true, __self: true, __source: true };
    function M(a, b, e) {
      var d, c = {}, k = null, h = null;
      if (null != b) for (d in void 0 !== b.ref && (h = b.ref), void 0 !== b.key && (k = "" + b.key), b) J.call(b, d) && !L.hasOwnProperty(d) && (c[d] = b[d]);
      var g = arguments.length - 2;
      if (1 === g) c.children = e;
      else if (1 < g) {
        for (var f = Array(g), m = 0; m < g; m++) f[m] = arguments[m + 2];
        c.children = f;
      }
      if (a && a.defaultProps) for (d in g = a.defaultProps, g) void 0 === c[d] && (c[d] = g[d]);
      return { $$typeof: l, type: a, key: k, ref: h, props: c, _owner: K.current };
    }
    function N(a, b) {
      return { $$typeof: l, type: a.type, key: b, ref: a.ref, props: a.props, _owner: a._owner };
    }
    function O(a) {
      return "object" === typeof a && null !== a && a.$$typeof === l;
    }
    function escape(a) {
      var b = { "=": "=0", ":": "=2" };
      return "$" + a.replace(/[=:]/g, function(a2) {
        return b[a2];
      });
    }
    var P = /\/+/g;
    function Q(a, b) {
      return "object" === typeof a && null !== a && null != a.key ? escape("" + a.key) : b.toString(36);
    }
    function R(a, b, e, d, c) {
      var k = typeof a;
      if ("undefined" === k || "boolean" === k) a = null;
      var h = false;
      if (null === a) h = true;
      else switch (k) {
        case "string":
        case "number":
          h = true;
          break;
        case "object":
          switch (a.$$typeof) {
            case l:
            case n:
              h = true;
          }
      }
      if (h) return h = a, c = c(h), a = "" === d ? "." + Q(h, 0) : d, I(c) ? (e = "", null != a && (e = a.replace(P, "$&/") + "/"), R(c, b, e, "", function(a2) {
        return a2;
      })) : null != c && (O(c) && (c = N(c, e + (!c.key || h && h.key === c.key ? "" : ("" + c.key).replace(P, "$&/") + "/") + a)), b.push(c)), 1;
      h = 0;
      d = "" === d ? "." : d + ":";
      if (I(a)) for (var g = 0; g < a.length; g++) {
        k = a[g];
        var f = d + Q(k, g);
        h += R(k, b, e, f, c);
      }
      else if (f = A(a), "function" === typeof f) for (a = f.call(a), g = 0; !(k = a.next()).done; ) k = k.value, f = d + Q(k, g++), h += R(k, b, e, f, c);
      else if ("object" === k) throw b = String(a), Error("Objects are not valid as a React child (found: " + ("[object Object]" === b ? "object with keys {" + Object.keys(a).join(", ") + "}" : b) + "). If you meant to render a collection of children, use an array instead.");
      return h;
    }
    function S(a, b, e) {
      if (null == a) return a;
      var d = [], c = 0;
      R(a, d, "", "", function(a2) {
        return b.call(e, a2, c++);
      });
      return d;
    }
    function T(a) {
      if (-1 === a._status) {
        var b = a._result;
        b = b();
        b.then(function(b2) {
          if (0 === a._status || -1 === a._status) a._status = 1, a._result = b2;
        }, function(b2) {
          if (0 === a._status || -1 === a._status) a._status = 2, a._result = b2;
        });
        -1 === a._status && (a._status = 0, a._result = b);
      }
      if (1 === a._status) return a._result.default;
      throw a._result;
    }
    var U = { current: null };
    var V = { transition: null };
    var W = { ReactCurrentDispatcher: U, ReactCurrentBatchConfig: V, ReactCurrentOwner: K };
    function X() {
      throw Error("act(...) is not supported in production builds of React.");
    }
    exports2.Children = { map: S, forEach: function(a, b, e) {
      S(a, function() {
        b.apply(this, arguments);
      }, e);
    }, count: function(a) {
      var b = 0;
      S(a, function() {
        b++;
      });
      return b;
    }, toArray: function(a) {
      return S(a, function(a2) {
        return a2;
      }) || [];
    }, only: function(a) {
      if (!O(a)) throw Error("React.Children.only expected to receive a single React element child.");
      return a;
    } };
    exports2.Component = E;
    exports2.Fragment = p;
    exports2.Profiler = r;
    exports2.PureComponent = G;
    exports2.StrictMode = q;
    exports2.Suspense = w;
    exports2.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = W;
    exports2.act = X;
    exports2.cloneElement = function(a, b, e) {
      if (null === a || void 0 === a) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + a + ".");
      var d = C({}, a.props), c = a.key, k = a.ref, h = a._owner;
      if (null != b) {
        void 0 !== b.ref && (k = b.ref, h = K.current);
        void 0 !== b.key && (c = "" + b.key);
        if (a.type && a.type.defaultProps) var g = a.type.defaultProps;
        for (f in b) J.call(b, f) && !L.hasOwnProperty(f) && (d[f] = void 0 === b[f] && void 0 !== g ? g[f] : b[f]);
      }
      var f = arguments.length - 2;
      if (1 === f) d.children = e;
      else if (1 < f) {
        g = Array(f);
        for (var m = 0; m < f; m++) g[m] = arguments[m + 2];
        d.children = g;
      }
      return { $$typeof: l, type: a.type, key: c, ref: k, props: d, _owner: h };
    };
    exports2.createContext = function(a) {
      a = { $$typeof: u, _currentValue: a, _currentValue2: a, _threadCount: 0, Provider: null, Consumer: null, _defaultValue: null, _globalName: null };
      a.Provider = { $$typeof: t, _context: a };
      return a.Consumer = a;
    };
    exports2.createElement = M;
    exports2.createFactory = function(a) {
      var b = M.bind(null, a);
      b.type = a;
      return b;
    };
    exports2.createRef = function() {
      return { current: null };
    };
    exports2.forwardRef = function(a) {
      return { $$typeof: v, render: a };
    };
    exports2.isValidElement = O;
    exports2.lazy = function(a) {
      return { $$typeof: y, _payload: { _status: -1, _result: a }, _init: T };
    };
    exports2.memo = function(a, b) {
      return { $$typeof: x, type: a, compare: void 0 === b ? null : b };
    };
    exports2.startTransition = function(a) {
      var b = V.transition;
      V.transition = {};
      try {
        a();
      } finally {
        V.transition = b;
      }
    };
    exports2.unstable_act = X;
    exports2.useCallback = function(a, b) {
      return U.current.useCallback(a, b);
    };
    exports2.useContext = function(a) {
      return U.current.useContext(a);
    };
    exports2.useDebugValue = function() {
    };
    exports2.useDeferredValue = function(a) {
      return U.current.useDeferredValue(a);
    };
    exports2.useEffect = function(a, b) {
      return U.current.useEffect(a, b);
    };
    exports2.useId = function() {
      return U.current.useId();
    };
    exports2.useImperativeHandle = function(a, b, e) {
      return U.current.useImperativeHandle(a, b, e);
    };
    exports2.useInsertionEffect = function(a, b) {
      return U.current.useInsertionEffect(a, b);
    };
    exports2.useLayoutEffect = function(a, b) {
      return U.current.useLayoutEffect(a, b);
    };
    exports2.useMemo = function(a, b) {
      return U.current.useMemo(a, b);
    };
    exports2.useReducer = function(a, b, e) {
      return U.current.useReducer(a, b, e);
    };
    exports2.useRef = function(a) {
      return U.current.useRef(a);
    };
    exports2.useState = function(a) {
      return U.current.useState(a);
    };
    exports2.useSyncExternalStore = function(a, b, e) {
      return U.current.useSyncExternalStore(a, b, e);
    };
    exports2.useTransition = function() {
      return U.current.useTransition();
    };
    exports2.version = "18.3.1";
  }
});

// node_modules/react/cjs/react.development.js
var require_react_development = __commonJS({
  "node_modules/react/cjs/react.development.js"(exports2, module2) {
    "use strict";
    if (process.env.NODE_ENV !== "production") {
      (function() {
        "use strict";
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart === "function") {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(new Error());
        }
        var ReactVersion = "18.3.1";
        var REACT_ELEMENT_TYPE = Symbol.for("react.element");
        var REACT_PORTAL_TYPE = Symbol.for("react.portal");
        var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
        var REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
        var REACT_PROFILER_TYPE = Symbol.for("react.profiler");
        var REACT_PROVIDER_TYPE = Symbol.for("react.provider");
        var REACT_CONTEXT_TYPE = Symbol.for("react.context");
        var REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
        var REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
        var REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list");
        var REACT_MEMO_TYPE = Symbol.for("react.memo");
        var REACT_LAZY_TYPE = Symbol.for("react.lazy");
        var REACT_OFFSCREEN_TYPE = Symbol.for("react.offscreen");
        var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
        var FAUX_ITERATOR_SYMBOL = "@@iterator";
        function getIteratorFn(maybeIterable) {
          if (maybeIterable === null || typeof maybeIterable !== "object") {
            return null;
          }
          var maybeIterator = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL];
          if (typeof maybeIterator === "function") {
            return maybeIterator;
          }
          return null;
        }
        var ReactCurrentDispatcher = {
          /**
           * @internal
           * @type {ReactComponent}
           */
          current: null
        };
        var ReactCurrentBatchConfig = {
          transition: null
        };
        var ReactCurrentActQueue = {
          current: null,
          // Used to reproduce behavior of `batchedUpdates` in legacy mode.
          isBatchingLegacy: false,
          didScheduleLegacyUpdate: false
        };
        var ReactCurrentOwner = {
          /**
           * @internal
           * @type {ReactComponent}
           */
          current: null
        };
        var ReactDebugCurrentFrame = {};
        var currentExtraStackFrame = null;
        function setExtraStackFrame(stack) {
          {
            currentExtraStackFrame = stack;
          }
        }
        {
          ReactDebugCurrentFrame.setExtraStackFrame = function(stack) {
            {
              currentExtraStackFrame = stack;
            }
          };
          ReactDebugCurrentFrame.getCurrentStack = null;
          ReactDebugCurrentFrame.getStackAddendum = function() {
            var stack = "";
            if (currentExtraStackFrame) {
              stack += currentExtraStackFrame;
            }
            var impl = ReactDebugCurrentFrame.getCurrentStack;
            if (impl) {
              stack += impl() || "";
            }
            return stack;
          };
        }
        var enableScopeAPI = false;
        var enableCacheElement = false;
        var enableTransitionTracing = false;
        var enableLegacyHidden = false;
        var enableDebugTracing = false;
        var ReactSharedInternals = {
          ReactCurrentDispatcher,
          ReactCurrentBatchConfig,
          ReactCurrentOwner
        };
        {
          ReactSharedInternals.ReactDebugCurrentFrame = ReactDebugCurrentFrame;
          ReactSharedInternals.ReactCurrentActQueue = ReactCurrentActQueue;
        }
        function warn(format) {
          {
            {
              for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
                args[_key - 1] = arguments[_key];
              }
              printWarning("warn", format, args);
            }
          }
        }
        function error(format) {
          {
            {
              for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
                args[_key2 - 1] = arguments[_key2];
              }
              printWarning("error", format, args);
            }
          }
        }
        function printWarning(level, format, args) {
          {
            var ReactDebugCurrentFrame2 = ReactSharedInternals.ReactDebugCurrentFrame;
            var stack = ReactDebugCurrentFrame2.getStackAddendum();
            if (stack !== "") {
              format += "%s";
              args = args.concat([stack]);
            }
            var argsWithFormat = args.map(function(item) {
              return String(item);
            });
            argsWithFormat.unshift("Warning: " + format);
            Function.prototype.apply.call(console[level], console, argsWithFormat);
          }
        }
        var didWarnStateUpdateForUnmountedComponent = {};
        function warnNoop(publicInstance, callerName) {
          {
            var _constructor = publicInstance.constructor;
            var componentName = _constructor && (_constructor.displayName || _constructor.name) || "ReactClass";
            var warningKey = componentName + "." + callerName;
            if (didWarnStateUpdateForUnmountedComponent[warningKey]) {
              return;
            }
            error("Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.", callerName, componentName);
            didWarnStateUpdateForUnmountedComponent[warningKey] = true;
          }
        }
        var ReactNoopUpdateQueue = {
          /**
           * Checks whether or not this composite component is mounted.
           * @param {ReactClass} publicInstance The instance we want to test.
           * @return {boolean} True if mounted, false otherwise.
           * @protected
           * @final
           */
          isMounted: function(publicInstance) {
            return false;
          },
          /**
           * Forces an update. This should only be invoked when it is known with
           * certainty that we are **not** in a DOM transaction.
           *
           * You may want to call this when you know that some deeper aspect of the
           * component's state has changed but `setState` was not called.
           *
           * This will not invoke `shouldComponentUpdate`, but it will invoke
           * `componentWillUpdate` and `componentDidUpdate`.
           *
           * @param {ReactClass} publicInstance The instance that should rerender.
           * @param {?function} callback Called after component is updated.
           * @param {?string} callerName name of the calling function in the public API.
           * @internal
           */
          enqueueForceUpdate: function(publicInstance, callback, callerName) {
            warnNoop(publicInstance, "forceUpdate");
          },
          /**
           * Replaces all of the state. Always use this or `setState` to mutate state.
           * You should treat `this.state` as immutable.
           *
           * There is no guarantee that `this.state` will be immediately updated, so
           * accessing `this.state` after calling this method may return the old value.
           *
           * @param {ReactClass} publicInstance The instance that should rerender.
           * @param {object} completeState Next state.
           * @param {?function} callback Called after component is updated.
           * @param {?string} callerName name of the calling function in the public API.
           * @internal
           */
          enqueueReplaceState: function(publicInstance, completeState, callback, callerName) {
            warnNoop(publicInstance, "replaceState");
          },
          /**
           * Sets a subset of the state. This only exists because _pendingState is
           * internal. This provides a merging strategy that is not available to deep
           * properties which is confusing. TODO: Expose pendingState or don't use it
           * during the merge.
           *
           * @param {ReactClass} publicInstance The instance that should rerender.
           * @param {object} partialState Next partial state to be merged with state.
           * @param {?function} callback Called after component is updated.
           * @param {?string} Name of the calling function in the public API.
           * @internal
           */
          enqueueSetState: function(publicInstance, partialState, callback, callerName) {
            warnNoop(publicInstance, "setState");
          }
        };
        var assign = Object.assign;
        var emptyObject = {};
        {
          Object.freeze(emptyObject);
        }
        function Component(props, context, updater) {
          this.props = props;
          this.context = context;
          this.refs = emptyObject;
          this.updater = updater || ReactNoopUpdateQueue;
        }
        Component.prototype.isReactComponent = {};
        Component.prototype.setState = function(partialState, callback) {
          if (typeof partialState !== "object" && typeof partialState !== "function" && partialState != null) {
            throw new Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
          }
          this.updater.enqueueSetState(this, partialState, callback, "setState");
        };
        Component.prototype.forceUpdate = function(callback) {
          this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
        };
        {
          var deprecatedAPIs = {
            isMounted: ["isMounted", "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."],
            replaceState: ["replaceState", "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."]
          };
          var defineDeprecationWarning = function(methodName, info) {
            Object.defineProperty(Component.prototype, methodName, {
              get: function() {
                warn("%s(...) is deprecated in plain JavaScript React classes. %s", info[0], info[1]);
                return void 0;
              }
            });
          };
          for (var fnName in deprecatedAPIs) {
            if (deprecatedAPIs.hasOwnProperty(fnName)) {
              defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
            }
          }
        }
        function ComponentDummy() {
        }
        ComponentDummy.prototype = Component.prototype;
        function PureComponent(props, context, updater) {
          this.props = props;
          this.context = context;
          this.refs = emptyObject;
          this.updater = updater || ReactNoopUpdateQueue;
        }
        var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
        pureComponentPrototype.constructor = PureComponent;
        assign(pureComponentPrototype, Component.prototype);
        pureComponentPrototype.isPureReactComponent = true;
        function createRef() {
          var refObject = {
            current: null
          };
          {
            Object.seal(refObject);
          }
          return refObject;
        }
        var isArrayImpl = Array.isArray;
        function isArray(a) {
          return isArrayImpl(a);
        }
        function typeName(value) {
          {
            var hasToStringTag = typeof Symbol === "function" && Symbol.toStringTag;
            var type = hasToStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
            return type;
          }
        }
        function willCoercionThrow(value) {
          {
            try {
              testStringCoercion(value);
              return false;
            } catch (e) {
              return true;
            }
          }
        }
        function testStringCoercion(value) {
          return "" + value;
        }
        function checkKeyStringCoercion(value) {
          {
            if (willCoercionThrow(value)) {
              error("The provided key is an unsupported type %s. This value must be coerced to a string before before using it here.", typeName(value));
              return testStringCoercion(value);
            }
          }
        }
        function getWrappedName(outerType, innerType, wrapperName) {
          var displayName = outerType.displayName;
          if (displayName) {
            return displayName;
          }
          var functionName = innerType.displayName || innerType.name || "";
          return functionName !== "" ? wrapperName + "(" + functionName + ")" : wrapperName;
        }
        function getContextName(type) {
          return type.displayName || "Context";
        }
        function getComponentNameFromType(type) {
          if (type == null) {
            return null;
          }
          {
            if (typeof type.tag === "number") {
              error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue.");
            }
          }
          if (typeof type === "function") {
            return type.displayName || type.name || null;
          }
          if (typeof type === "string") {
            return type;
          }
          switch (type) {
            case REACT_FRAGMENT_TYPE:
              return "Fragment";
            case REACT_PORTAL_TYPE:
              return "Portal";
            case REACT_PROFILER_TYPE:
              return "Profiler";
            case REACT_STRICT_MODE_TYPE:
              return "StrictMode";
            case REACT_SUSPENSE_TYPE:
              return "Suspense";
            case REACT_SUSPENSE_LIST_TYPE:
              return "SuspenseList";
          }
          if (typeof type === "object") {
            switch (type.$$typeof) {
              case REACT_CONTEXT_TYPE:
                var context = type;
                return getContextName(context) + ".Consumer";
              case REACT_PROVIDER_TYPE:
                var provider = type;
                return getContextName(provider._context) + ".Provider";
              case REACT_FORWARD_REF_TYPE:
                return getWrappedName(type, type.render, "ForwardRef");
              case REACT_MEMO_TYPE:
                var outerName = type.displayName || null;
                if (outerName !== null) {
                  return outerName;
                }
                return getComponentNameFromType(type.type) || "Memo";
              case REACT_LAZY_TYPE: {
                var lazyComponent = type;
                var payload = lazyComponent._payload;
                var init = lazyComponent._init;
                try {
                  return getComponentNameFromType(init(payload));
                } catch (x) {
                  return null;
                }
              }
            }
          }
          return null;
        }
        var hasOwnProperty = Object.prototype.hasOwnProperty;
        var RESERVED_PROPS = {
          key: true,
          ref: true,
          __self: true,
          __source: true
        };
        var specialPropKeyWarningShown, specialPropRefWarningShown, didWarnAboutStringRefs;
        {
          didWarnAboutStringRefs = {};
        }
        function hasValidRef(config) {
          {
            if (hasOwnProperty.call(config, "ref")) {
              var getter = Object.getOwnPropertyDescriptor(config, "ref").get;
              if (getter && getter.isReactWarning) {
                return false;
              }
            }
          }
          return config.ref !== void 0;
        }
        function hasValidKey(config) {
          {
            if (hasOwnProperty.call(config, "key")) {
              var getter = Object.getOwnPropertyDescriptor(config, "key").get;
              if (getter && getter.isReactWarning) {
                return false;
              }
            }
          }
          return config.key !== void 0;
        }
        function defineKeyPropWarningGetter(props, displayName) {
          var warnAboutAccessingKey = function() {
            {
              if (!specialPropKeyWarningShown) {
                specialPropKeyWarningShown = true;
                error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
              }
            }
          };
          warnAboutAccessingKey.isReactWarning = true;
          Object.defineProperty(props, "key", {
            get: warnAboutAccessingKey,
            configurable: true
          });
        }
        function defineRefPropWarningGetter(props, displayName) {
          var warnAboutAccessingRef = function() {
            {
              if (!specialPropRefWarningShown) {
                specialPropRefWarningShown = true;
                error("%s: `ref` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://reactjs.org/link/special-props)", displayName);
              }
            }
          };
          warnAboutAccessingRef.isReactWarning = true;
          Object.defineProperty(props, "ref", {
            get: warnAboutAccessingRef,
            configurable: true
          });
        }
        function warnIfStringRefCannotBeAutoConverted(config) {
          {
            if (typeof config.ref === "string" && ReactCurrentOwner.current && config.__self && ReactCurrentOwner.current.stateNode !== config.__self) {
              var componentName = getComponentNameFromType(ReactCurrentOwner.current.type);
              if (!didWarnAboutStringRefs[componentName]) {
                error('Component "%s" contains the string ref "%s". Support for string refs will be removed in a future major release. This case cannot be automatically converted to an arrow function. We ask you to manually fix this case by using useRef() or createRef() instead. Learn more about using refs safely here: https://reactjs.org/link/strict-mode-string-ref', componentName, config.ref);
                didWarnAboutStringRefs[componentName] = true;
              }
            }
          }
        }
        var ReactElement = function(type, key, ref, self, source, owner, props) {
          var element = {
            // This tag allows us to uniquely identify this as a React Element
            $$typeof: REACT_ELEMENT_TYPE,
            // Built-in properties that belong on the element
            type,
            key,
            ref,
            props,
            // Record the component responsible for creating this element.
            _owner: owner
          };
          {
            element._store = {};
            Object.defineProperty(element._store, "validated", {
              configurable: false,
              enumerable: false,
              writable: true,
              value: false
            });
            Object.defineProperty(element, "_self", {
              configurable: false,
              enumerable: false,
              writable: false,
              value: self
            });
            Object.defineProperty(element, "_source", {
              configurable: false,
              enumerable: false,
              writable: false,
              value: source
            });
            if (Object.freeze) {
              Object.freeze(element.props);
              Object.freeze(element);
            }
          }
          return element;
        };
        function createElement(type, config, children) {
          var propName;
          var props = {};
          var key = null;
          var ref = null;
          var self = null;
          var source = null;
          if (config != null) {
            if (hasValidRef(config)) {
              ref = config.ref;
              {
                warnIfStringRefCannotBeAutoConverted(config);
              }
            }
            if (hasValidKey(config)) {
              {
                checkKeyStringCoercion(config.key);
              }
              key = "" + config.key;
            }
            self = config.__self === void 0 ? null : config.__self;
            source = config.__source === void 0 ? null : config.__source;
            for (propName in config) {
              if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
                props[propName] = config[propName];
              }
            }
          }
          var childrenLength = arguments.length - 2;
          if (childrenLength === 1) {
            props.children = children;
          } else if (childrenLength > 1) {
            var childArray = Array(childrenLength);
            for (var i = 0; i < childrenLength; i++) {
              childArray[i] = arguments[i + 2];
            }
            {
              if (Object.freeze) {
                Object.freeze(childArray);
              }
            }
            props.children = childArray;
          }
          if (type && type.defaultProps) {
            var defaultProps = type.defaultProps;
            for (propName in defaultProps) {
              if (props[propName] === void 0) {
                props[propName] = defaultProps[propName];
              }
            }
          }
          {
            if (key || ref) {
              var displayName = typeof type === "function" ? type.displayName || type.name || "Unknown" : type;
              if (key) {
                defineKeyPropWarningGetter(props, displayName);
              }
              if (ref) {
                defineRefPropWarningGetter(props, displayName);
              }
            }
          }
          return ReactElement(type, key, ref, self, source, ReactCurrentOwner.current, props);
        }
        function cloneAndReplaceKey(oldElement, newKey) {
          var newElement = ReactElement(oldElement.type, newKey, oldElement.ref, oldElement._self, oldElement._source, oldElement._owner, oldElement.props);
          return newElement;
        }
        function cloneElement(element, config, children) {
          if (element === null || element === void 0) {
            throw new Error("React.cloneElement(...): The argument must be a React element, but you passed " + element + ".");
          }
          var propName;
          var props = assign({}, element.props);
          var key = element.key;
          var ref = element.ref;
          var self = element._self;
          var source = element._source;
          var owner = element._owner;
          if (config != null) {
            if (hasValidRef(config)) {
              ref = config.ref;
              owner = ReactCurrentOwner.current;
            }
            if (hasValidKey(config)) {
              {
                checkKeyStringCoercion(config.key);
              }
              key = "" + config.key;
            }
            var defaultProps;
            if (element.type && element.type.defaultProps) {
              defaultProps = element.type.defaultProps;
            }
            for (propName in config) {
              if (hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)) {
                if (config[propName] === void 0 && defaultProps !== void 0) {
                  props[propName] = defaultProps[propName];
                } else {
                  props[propName] = config[propName];
                }
              }
            }
          }
          var childrenLength = arguments.length - 2;
          if (childrenLength === 1) {
            props.children = children;
          } else if (childrenLength > 1) {
            var childArray = Array(childrenLength);
            for (var i = 0; i < childrenLength; i++) {
              childArray[i] = arguments[i + 2];
            }
            props.children = childArray;
          }
          return ReactElement(element.type, key, ref, self, source, owner, props);
        }
        function isValidElement(object) {
          return typeof object === "object" && object !== null && object.$$typeof === REACT_ELEMENT_TYPE;
        }
        var SEPARATOR = ".";
        var SUBSEPARATOR = ":";
        function escape(key) {
          var escapeRegex = /[=:]/g;
          var escaperLookup = {
            "=": "=0",
            ":": "=2"
          };
          var escapedString = key.replace(escapeRegex, function(match) {
            return escaperLookup[match];
          });
          return "$" + escapedString;
        }
        var didWarnAboutMaps = false;
        var userProvidedKeyEscapeRegex = /\/+/g;
        function escapeUserProvidedKey(text3) {
          return text3.replace(userProvidedKeyEscapeRegex, "$&/");
        }
        function getElementKey(element, index) {
          if (typeof element === "object" && element !== null && element.key != null) {
            {
              checkKeyStringCoercion(element.key);
            }
            return escape("" + element.key);
          }
          return index.toString(36);
        }
        function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
          var type = typeof children;
          if (type === "undefined" || type === "boolean") {
            children = null;
          }
          var invokeCallback = false;
          if (children === null) {
            invokeCallback = true;
          } else {
            switch (type) {
              case "string":
              case "number":
                invokeCallback = true;
                break;
              case "object":
                switch (children.$$typeof) {
                  case REACT_ELEMENT_TYPE:
                  case REACT_PORTAL_TYPE:
                    invokeCallback = true;
                }
            }
          }
          if (invokeCallback) {
            var _child = children;
            var mappedChild = callback(_child);
            var childKey = nameSoFar === "" ? SEPARATOR + getElementKey(_child, 0) : nameSoFar;
            if (isArray(mappedChild)) {
              var escapedChildKey = "";
              if (childKey != null) {
                escapedChildKey = escapeUserProvidedKey(childKey) + "/";
              }
              mapIntoArray(mappedChild, array, escapedChildKey, "", function(c) {
                return c;
              });
            } else if (mappedChild != null) {
              if (isValidElement(mappedChild)) {
                {
                  if (mappedChild.key && (!_child || _child.key !== mappedChild.key)) {
                    checkKeyStringCoercion(mappedChild.key);
                  }
                }
                mappedChild = cloneAndReplaceKey(
                  mappedChild,
                  // Keep both the (mapped) and old keys if they differ, just as
                  // traverseAllChildren used to do for objects as children
                  escapedPrefix + // $FlowFixMe Flow incorrectly thinks React.Portal doesn't have a key
                  (mappedChild.key && (!_child || _child.key !== mappedChild.key) ? (
                    // $FlowFixMe Flow incorrectly thinks existing element's key can be a number
                    // eslint-disable-next-line react-internal/safe-string-coercion
                    escapeUserProvidedKey("" + mappedChild.key) + "/"
                  ) : "") + childKey
                );
              }
              array.push(mappedChild);
            }
            return 1;
          }
          var child;
          var nextName;
          var subtreeCount = 0;
          var nextNamePrefix = nameSoFar === "" ? SEPARATOR : nameSoFar + SUBSEPARATOR;
          if (isArray(children)) {
            for (var i = 0; i < children.length; i++) {
              child = children[i];
              nextName = nextNamePrefix + getElementKey(child, i);
              subtreeCount += mapIntoArray(child, array, escapedPrefix, nextName, callback);
            }
          } else {
            var iteratorFn = getIteratorFn(children);
            if (typeof iteratorFn === "function") {
              var iterableChildren = children;
              {
                if (iteratorFn === iterableChildren.entries) {
                  if (!didWarnAboutMaps) {
                    warn("Using Maps as children is not supported. Use an array of keyed ReactElements instead.");
                  }
                  didWarnAboutMaps = true;
                }
              }
              var iterator = iteratorFn.call(iterableChildren);
              var step;
              var ii = 0;
              while (!(step = iterator.next()).done) {
                child = step.value;
                nextName = nextNamePrefix + getElementKey(child, ii++);
                subtreeCount += mapIntoArray(child, array, escapedPrefix, nextName, callback);
              }
            } else if (type === "object") {
              var childrenString = String(children);
              throw new Error("Objects are not valid as a React child (found: " + (childrenString === "[object Object]" ? "object with keys {" + Object.keys(children).join(", ") + "}" : childrenString) + "). If you meant to render a collection of children, use an array instead.");
            }
          }
          return subtreeCount;
        }
        function mapChildren(children, func, context) {
          if (children == null) {
            return children;
          }
          var result = [];
          var count = 0;
          mapIntoArray(children, result, "", "", function(child) {
            return func.call(context, child, count++);
          });
          return result;
        }
        function countChildren(children) {
          var n = 0;
          mapChildren(children, function() {
            n++;
          });
          return n;
        }
        function forEachChildren(children, forEachFunc, forEachContext) {
          mapChildren(children, function() {
            forEachFunc.apply(this, arguments);
          }, forEachContext);
        }
        function toArray(children) {
          return mapChildren(children, function(child) {
            return child;
          }) || [];
        }
        function onlyChild(children) {
          if (!isValidElement(children)) {
            throw new Error("React.Children.only expected to receive a single React element child.");
          }
          return children;
        }
        function createContext(defaultValue) {
          var context = {
            $$typeof: REACT_CONTEXT_TYPE,
            // As a workaround to support multiple concurrent renderers, we categorize
            // some renderers as primary and others as secondary. We only expect
            // there to be two concurrent renderers at most: React Native (primary) and
            // Fabric (secondary); React DOM (primary) and React ART (secondary).
            // Secondary renderers store their context values on separate fields.
            _currentValue: defaultValue,
            _currentValue2: defaultValue,
            // Used to track how many concurrent renderers this context currently
            // supports within in a single renderer. Such as parallel server rendering.
            _threadCount: 0,
            // These are circular
            Provider: null,
            Consumer: null,
            // Add these to use same hidden class in VM as ServerContext
            _defaultValue: null,
            _globalName: null
          };
          context.Provider = {
            $$typeof: REACT_PROVIDER_TYPE,
            _context: context
          };
          var hasWarnedAboutUsingNestedContextConsumers = false;
          var hasWarnedAboutUsingConsumerProvider = false;
          var hasWarnedAboutDisplayNameOnConsumer = false;
          {
            var Consumer = {
              $$typeof: REACT_CONTEXT_TYPE,
              _context: context
            };
            Object.defineProperties(Consumer, {
              Provider: {
                get: function() {
                  if (!hasWarnedAboutUsingConsumerProvider) {
                    hasWarnedAboutUsingConsumerProvider = true;
                    error("Rendering <Context.Consumer.Provider> is not supported and will be removed in a future major release. Did you mean to render <Context.Provider> instead?");
                  }
                  return context.Provider;
                },
                set: function(_Provider) {
                  context.Provider = _Provider;
                }
              },
              _currentValue: {
                get: function() {
                  return context._currentValue;
                },
                set: function(_currentValue) {
                  context._currentValue = _currentValue;
                }
              },
              _currentValue2: {
                get: function() {
                  return context._currentValue2;
                },
                set: function(_currentValue2) {
                  context._currentValue2 = _currentValue2;
                }
              },
              _threadCount: {
                get: function() {
                  return context._threadCount;
                },
                set: function(_threadCount) {
                  context._threadCount = _threadCount;
                }
              },
              Consumer: {
                get: function() {
                  if (!hasWarnedAboutUsingNestedContextConsumers) {
                    hasWarnedAboutUsingNestedContextConsumers = true;
                    error("Rendering <Context.Consumer.Consumer> is not supported and will be removed in a future major release. Did you mean to render <Context.Consumer> instead?");
                  }
                  return context.Consumer;
                }
              },
              displayName: {
                get: function() {
                  return context.displayName;
                },
                set: function(displayName) {
                  if (!hasWarnedAboutDisplayNameOnConsumer) {
                    warn("Setting `displayName` on Context.Consumer has no effect. You should set it directly on the context with Context.displayName = '%s'.", displayName);
                    hasWarnedAboutDisplayNameOnConsumer = true;
                  }
                }
              }
            });
            context.Consumer = Consumer;
          }
          {
            context._currentRenderer = null;
            context._currentRenderer2 = null;
          }
          return context;
        }
        var Uninitialized = -1;
        var Pending = 0;
        var Resolved = 1;
        var Rejected = 2;
        function lazyInitializer(payload) {
          if (payload._status === Uninitialized) {
            var ctor = payload._result;
            var thenable = ctor();
            thenable.then(function(moduleObject2) {
              if (payload._status === Pending || payload._status === Uninitialized) {
                var resolved = payload;
                resolved._status = Resolved;
                resolved._result = moduleObject2;
              }
            }, function(error2) {
              if (payload._status === Pending || payload._status === Uninitialized) {
                var rejected = payload;
                rejected._status = Rejected;
                rejected._result = error2;
              }
            });
            if (payload._status === Uninitialized) {
              var pending = payload;
              pending._status = Pending;
              pending._result = thenable;
            }
          }
          if (payload._status === Resolved) {
            var moduleObject = payload._result;
            {
              if (moduleObject === void 0) {
                error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?", moduleObject);
              }
            }
            {
              if (!("default" in moduleObject)) {
                error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))", moduleObject);
              }
            }
            return moduleObject.default;
          } else {
            throw payload._result;
          }
        }
        function lazy(ctor) {
          var payload = {
            // We use these fields to store the result.
            _status: Uninitialized,
            _result: ctor
          };
          var lazyType = {
            $$typeof: REACT_LAZY_TYPE,
            _payload: payload,
            _init: lazyInitializer
          };
          {
            var defaultProps;
            var propTypes;
            Object.defineProperties(lazyType, {
              defaultProps: {
                configurable: true,
                get: function() {
                  return defaultProps;
                },
                set: function(newDefaultProps) {
                  error("React.lazy(...): It is not supported to assign `defaultProps` to a lazy component import. Either specify them where the component is defined, or create a wrapping component around it.");
                  defaultProps = newDefaultProps;
                  Object.defineProperty(lazyType, "defaultProps", {
                    enumerable: true
                  });
                }
              },
              propTypes: {
                configurable: true,
                get: function() {
                  return propTypes;
                },
                set: function(newPropTypes) {
                  error("React.lazy(...): It is not supported to assign `propTypes` to a lazy component import. Either specify them where the component is defined, or create a wrapping component around it.");
                  propTypes = newPropTypes;
                  Object.defineProperty(lazyType, "propTypes", {
                    enumerable: true
                  });
                }
              }
            });
          }
          return lazyType;
        }
        function forwardRef(render) {
          {
            if (render != null && render.$$typeof === REACT_MEMO_TYPE) {
              error("forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...)).");
            } else if (typeof render !== "function") {
              error("forwardRef requires a render function but was given %s.", render === null ? "null" : typeof render);
            } else {
              if (render.length !== 0 && render.length !== 2) {
                error("forwardRef render functions accept exactly two parameters: props and ref. %s", render.length === 1 ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined.");
              }
            }
            if (render != null) {
              if (render.defaultProps != null || render.propTypes != null) {
                error("forwardRef render functions do not support propTypes or defaultProps. Did you accidentally pass a React component?");
              }
            }
          }
          var elementType = {
            $$typeof: REACT_FORWARD_REF_TYPE,
            render
          };
          {
            var ownName;
            Object.defineProperty(elementType, "displayName", {
              enumerable: false,
              configurable: true,
              get: function() {
                return ownName;
              },
              set: function(name) {
                ownName = name;
                if (!render.name && !render.displayName) {
                  render.displayName = name;
                }
              }
            });
          }
          return elementType;
        }
        var REACT_MODULE_REFERENCE;
        {
          REACT_MODULE_REFERENCE = Symbol.for("react.module.reference");
        }
        function isValidElementType(type) {
          if (typeof type === "string" || typeof type === "function") {
            return true;
          }
          if (type === REACT_FRAGMENT_TYPE || type === REACT_PROFILER_TYPE || enableDebugTracing || type === REACT_STRICT_MODE_TYPE || type === REACT_SUSPENSE_TYPE || type === REACT_SUSPENSE_LIST_TYPE || enableLegacyHidden || type === REACT_OFFSCREEN_TYPE || enableScopeAPI || enableCacheElement || enableTransitionTracing) {
            return true;
          }
          if (typeof type === "object" && type !== null) {
            if (type.$$typeof === REACT_LAZY_TYPE || type.$$typeof === REACT_MEMO_TYPE || type.$$typeof === REACT_PROVIDER_TYPE || type.$$typeof === REACT_CONTEXT_TYPE || type.$$typeof === REACT_FORWARD_REF_TYPE || // This needs to include all possible module reference object
            // types supported by any Flight configuration anywhere since
            // we don't know which Flight build this will end up being used
            // with.
            type.$$typeof === REACT_MODULE_REFERENCE || type.getModuleId !== void 0) {
              return true;
            }
          }
          return false;
        }
        function memo(type, compare) {
          {
            if (!isValidElementType(type)) {
              error("memo: The first argument must be a component. Instead received: %s", type === null ? "null" : typeof type);
            }
          }
          var elementType = {
            $$typeof: REACT_MEMO_TYPE,
            type,
            compare: compare === void 0 ? null : compare
          };
          {
            var ownName;
            Object.defineProperty(elementType, "displayName", {
              enumerable: false,
              configurable: true,
              get: function() {
                return ownName;
              },
              set: function(name) {
                ownName = name;
                if (!type.name && !type.displayName) {
                  type.displayName = name;
                }
              }
            });
          }
          return elementType;
        }
        function resolveDispatcher() {
          var dispatcher = ReactCurrentDispatcher.current;
          {
            if (dispatcher === null) {
              error("Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://reactjs.org/link/invalid-hook-call for tips about how to debug and fix this problem.");
            }
          }
          return dispatcher;
        }
        function useContext(Context) {
          var dispatcher = resolveDispatcher();
          {
            if (Context._context !== void 0) {
              var realContext = Context._context;
              if (realContext.Consumer === Context) {
                error("Calling useContext(Context.Consumer) is not supported, may cause bugs, and will be removed in a future major release. Did you mean to call useContext(Context) instead?");
              } else if (realContext.Provider === Context) {
                error("Calling useContext(Context.Provider) is not supported. Did you mean to call useContext(Context) instead?");
              }
            }
          }
          return dispatcher.useContext(Context);
        }
        function useState(initialState) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useState(initialState);
        }
        function useReducer(reducer, initialArg, init) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useReducer(reducer, initialArg, init);
        }
        function useRef(initialValue) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useRef(initialValue);
        }
        function useEffect(create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useEffect(create, deps);
        }
        function useInsertionEffect(create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useInsertionEffect(create, deps);
        }
        function useLayoutEffect(create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useLayoutEffect(create, deps);
        }
        function useCallback(callback, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useCallback(callback, deps);
        }
        function useMemo(create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useMemo(create, deps);
        }
        function useImperativeHandle(ref, create, deps) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useImperativeHandle(ref, create, deps);
        }
        function useDebugValue(value, formatterFn) {
          {
            var dispatcher = resolveDispatcher();
            return dispatcher.useDebugValue(value, formatterFn);
          }
        }
        function useTransition() {
          var dispatcher = resolveDispatcher();
          return dispatcher.useTransition();
        }
        function useDeferredValue(value) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useDeferredValue(value);
        }
        function useId() {
          var dispatcher = resolveDispatcher();
          return dispatcher.useId();
        }
        function useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
          var dispatcher = resolveDispatcher();
          return dispatcher.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
        }
        var disabledDepth = 0;
        var prevLog;
        var prevInfo;
        var prevWarn;
        var prevError;
        var prevGroup;
        var prevGroupCollapsed;
        var prevGroupEnd;
        function disabledLog() {
        }
        disabledLog.__reactDisabledLog = true;
        function disableLogs() {
          {
            if (disabledDepth === 0) {
              prevLog = console.log;
              prevInfo = console.info;
              prevWarn = console.warn;
              prevError = console.error;
              prevGroup = console.group;
              prevGroupCollapsed = console.groupCollapsed;
              prevGroupEnd = console.groupEnd;
              var props = {
                configurable: true,
                enumerable: true,
                value: disabledLog,
                writable: true
              };
              Object.defineProperties(console, {
                info: props,
                log: props,
                warn: props,
                error: props,
                group: props,
                groupCollapsed: props,
                groupEnd: props
              });
            }
            disabledDepth++;
          }
        }
        function reenableLogs() {
          {
            disabledDepth--;
            if (disabledDepth === 0) {
              var props = {
                configurable: true,
                enumerable: true,
                writable: true
              };
              Object.defineProperties(console, {
                log: assign({}, props, {
                  value: prevLog
                }),
                info: assign({}, props, {
                  value: prevInfo
                }),
                warn: assign({}, props, {
                  value: prevWarn
                }),
                error: assign({}, props, {
                  value: prevError
                }),
                group: assign({}, props, {
                  value: prevGroup
                }),
                groupCollapsed: assign({}, props, {
                  value: prevGroupCollapsed
                }),
                groupEnd: assign({}, props, {
                  value: prevGroupEnd
                })
              });
            }
            if (disabledDepth < 0) {
              error("disabledDepth fell below zero. This is a bug in React. Please file an issue.");
            }
          }
        }
        var ReactCurrentDispatcher$1 = ReactSharedInternals.ReactCurrentDispatcher;
        var prefix;
        function describeBuiltInComponentFrame(name, source, ownerFn) {
          {
            if (prefix === void 0) {
              try {
                throw Error();
              } catch (x) {
                var match = x.stack.trim().match(/\n( *(at )?)/);
                prefix = match && match[1] || "";
              }
            }
            return "\n" + prefix + name;
          }
        }
        var reentry = false;
        var componentFrameCache;
        {
          var PossiblyWeakMap = typeof WeakMap === "function" ? WeakMap : Map;
          componentFrameCache = new PossiblyWeakMap();
        }
        function describeNativeComponentFrame(fn, construct) {
          if (!fn || reentry) {
            return "";
          }
          {
            var frame = componentFrameCache.get(fn);
            if (frame !== void 0) {
              return frame;
            }
          }
          var control;
          reentry = true;
          var previousPrepareStackTrace = Error.prepareStackTrace;
          Error.prepareStackTrace = void 0;
          var previousDispatcher;
          {
            previousDispatcher = ReactCurrentDispatcher$1.current;
            ReactCurrentDispatcher$1.current = null;
            disableLogs();
          }
          try {
            if (construct) {
              var Fake = function() {
                throw Error();
              };
              Object.defineProperty(Fake.prototype, "props", {
                set: function() {
                  throw Error();
                }
              });
              if (typeof Reflect === "object" && Reflect.construct) {
                try {
                  Reflect.construct(Fake, []);
                } catch (x) {
                  control = x;
                }
                Reflect.construct(fn, [], Fake);
              } else {
                try {
                  Fake.call();
                } catch (x) {
                  control = x;
                }
                fn.call(Fake.prototype);
              }
            } else {
              try {
                throw Error();
              } catch (x) {
                control = x;
              }
              fn();
            }
          } catch (sample) {
            if (sample && control && typeof sample.stack === "string") {
              var sampleLines = sample.stack.split("\n");
              var controlLines = control.stack.split("\n");
              var s = sampleLines.length - 1;
              var c = controlLines.length - 1;
              while (s >= 1 && c >= 0 && sampleLines[s] !== controlLines[c]) {
                c--;
              }
              for (; s >= 1 && c >= 0; s--, c--) {
                if (sampleLines[s] !== controlLines[c]) {
                  if (s !== 1 || c !== 1) {
                    do {
                      s--;
                      c--;
                      if (c < 0 || sampleLines[s] !== controlLines[c]) {
                        var _frame = "\n" + sampleLines[s].replace(" at new ", " at ");
                        if (fn.displayName && _frame.includes("<anonymous>")) {
                          _frame = _frame.replace("<anonymous>", fn.displayName);
                        }
                        {
                          if (typeof fn === "function") {
                            componentFrameCache.set(fn, _frame);
                          }
                        }
                        return _frame;
                      }
                    } while (s >= 1 && c >= 0);
                  }
                  break;
                }
              }
            }
          } finally {
            reentry = false;
            {
              ReactCurrentDispatcher$1.current = previousDispatcher;
              reenableLogs();
            }
            Error.prepareStackTrace = previousPrepareStackTrace;
          }
          var name = fn ? fn.displayName || fn.name : "";
          var syntheticFrame = name ? describeBuiltInComponentFrame(name) : "";
          {
            if (typeof fn === "function") {
              componentFrameCache.set(fn, syntheticFrame);
            }
          }
          return syntheticFrame;
        }
        function describeFunctionComponentFrame(fn, source, ownerFn) {
          {
            return describeNativeComponentFrame(fn, false);
          }
        }
        function shouldConstruct(Component2) {
          var prototype = Component2.prototype;
          return !!(prototype && prototype.isReactComponent);
        }
        function describeUnknownElementTypeFrameInDEV(type, source, ownerFn) {
          if (type == null) {
            return "";
          }
          if (typeof type === "function") {
            {
              return describeNativeComponentFrame(type, shouldConstruct(type));
            }
          }
          if (typeof type === "string") {
            return describeBuiltInComponentFrame(type);
          }
          switch (type) {
            case REACT_SUSPENSE_TYPE:
              return describeBuiltInComponentFrame("Suspense");
            case REACT_SUSPENSE_LIST_TYPE:
              return describeBuiltInComponentFrame("SuspenseList");
          }
          if (typeof type === "object") {
            switch (type.$$typeof) {
              case REACT_FORWARD_REF_TYPE:
                return describeFunctionComponentFrame(type.render);
              case REACT_MEMO_TYPE:
                return describeUnknownElementTypeFrameInDEV(type.type, source, ownerFn);
              case REACT_LAZY_TYPE: {
                var lazyComponent = type;
                var payload = lazyComponent._payload;
                var init = lazyComponent._init;
                try {
                  return describeUnknownElementTypeFrameInDEV(init(payload), source, ownerFn);
                } catch (x) {
                }
              }
            }
          }
          return "";
        }
        var loggedTypeFailures = {};
        var ReactDebugCurrentFrame$1 = ReactSharedInternals.ReactDebugCurrentFrame;
        function setCurrentlyValidatingElement(element) {
          {
            if (element) {
              var owner = element._owner;
              var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
              ReactDebugCurrentFrame$1.setExtraStackFrame(stack);
            } else {
              ReactDebugCurrentFrame$1.setExtraStackFrame(null);
            }
          }
        }
        function checkPropTypes(typeSpecs, values, location, componentName, element) {
          {
            var has = Function.call.bind(hasOwnProperty);
            for (var typeSpecName in typeSpecs) {
              if (has(typeSpecs, typeSpecName)) {
                var error$1 = void 0;
                try {
                  if (typeof typeSpecs[typeSpecName] !== "function") {
                    var err = Error((componentName || "React class") + ": " + location + " type `" + typeSpecName + "` is invalid; it must be a function, usually from the `prop-types` package, but received `" + typeof typeSpecs[typeSpecName] + "`.This often happens because of typos such as `PropTypes.function` instead of `PropTypes.func`.");
                    err.name = "Invariant Violation";
                    throw err;
                  }
                  error$1 = typeSpecs[typeSpecName](values, typeSpecName, componentName, location, null, "SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED");
                } catch (ex) {
                  error$1 = ex;
                }
                if (error$1 && !(error$1 instanceof Error)) {
                  setCurrentlyValidatingElement(element);
                  error("%s: type specification of %s `%s` is invalid; the type checker function must return `null` or an `Error` but returned a %s. You may have forgotten to pass an argument to the type checker creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and shape all require an argument).", componentName || "React class", location, typeSpecName, typeof error$1);
                  setCurrentlyValidatingElement(null);
                }
                if (error$1 instanceof Error && !(error$1.message in loggedTypeFailures)) {
                  loggedTypeFailures[error$1.message] = true;
                  setCurrentlyValidatingElement(element);
                  error("Failed %s type: %s", location, error$1.message);
                  setCurrentlyValidatingElement(null);
                }
              }
            }
          }
        }
        function setCurrentlyValidatingElement$1(element) {
          {
            if (element) {
              var owner = element._owner;
              var stack = describeUnknownElementTypeFrameInDEV(element.type, element._source, owner ? owner.type : null);
              setExtraStackFrame(stack);
            } else {
              setExtraStackFrame(null);
            }
          }
        }
        var propTypesMisspellWarningShown;
        {
          propTypesMisspellWarningShown = false;
        }
        function getDeclarationErrorAddendum() {
          if (ReactCurrentOwner.current) {
            var name = getComponentNameFromType(ReactCurrentOwner.current.type);
            if (name) {
              return "\n\nCheck the render method of `" + name + "`.";
            }
          }
          return "";
        }
        function getSourceInfoErrorAddendum(source) {
          if (source !== void 0) {
            var fileName = source.fileName.replace(/^.*[\\\/]/, "");
            var lineNumber = source.lineNumber;
            return "\n\nCheck your code at " + fileName + ":" + lineNumber + ".";
          }
          return "";
        }
        function getSourceInfoErrorAddendumForProps(elementProps) {
          if (elementProps !== null && elementProps !== void 0) {
            return getSourceInfoErrorAddendum(elementProps.__source);
          }
          return "";
        }
        var ownerHasKeyUseWarning = {};
        function getCurrentComponentErrorInfo(parentType) {
          var info = getDeclarationErrorAddendum();
          if (!info) {
            var parentName = typeof parentType === "string" ? parentType : parentType.displayName || parentType.name;
            if (parentName) {
              info = "\n\nCheck the top-level render call using <" + parentName + ">.";
            }
          }
          return info;
        }
        function validateExplicitKey(element, parentType) {
          if (!element._store || element._store.validated || element.key != null) {
            return;
          }
          element._store.validated = true;
          var currentComponentErrorInfo = getCurrentComponentErrorInfo(parentType);
          if (ownerHasKeyUseWarning[currentComponentErrorInfo]) {
            return;
          }
          ownerHasKeyUseWarning[currentComponentErrorInfo] = true;
          var childOwner = "";
          if (element && element._owner && element._owner !== ReactCurrentOwner.current) {
            childOwner = " It was passed a child from " + getComponentNameFromType(element._owner.type) + ".";
          }
          {
            setCurrentlyValidatingElement$1(element);
            error('Each child in a list should have a unique "key" prop.%s%s See https://reactjs.org/link/warning-keys for more information.', currentComponentErrorInfo, childOwner);
            setCurrentlyValidatingElement$1(null);
          }
        }
        function validateChildKeys(node, parentType) {
          if (typeof node !== "object") {
            return;
          }
          if (isArray(node)) {
            for (var i = 0; i < node.length; i++) {
              var child = node[i];
              if (isValidElement(child)) {
                validateExplicitKey(child, parentType);
              }
            }
          } else if (isValidElement(node)) {
            if (node._store) {
              node._store.validated = true;
            }
          } else if (node) {
            var iteratorFn = getIteratorFn(node);
            if (typeof iteratorFn === "function") {
              if (iteratorFn !== node.entries) {
                var iterator = iteratorFn.call(node);
                var step;
                while (!(step = iterator.next()).done) {
                  if (isValidElement(step.value)) {
                    validateExplicitKey(step.value, parentType);
                  }
                }
              }
            }
          }
        }
        function validatePropTypes(element) {
          {
            var type = element.type;
            if (type === null || type === void 0 || typeof type === "string") {
              return;
            }
            var propTypes;
            if (typeof type === "function") {
              propTypes = type.propTypes;
            } else if (typeof type === "object" && (type.$$typeof === REACT_FORWARD_REF_TYPE || // Note: Memo only checks outer props here.
            // Inner props are checked in the reconciler.
            type.$$typeof === REACT_MEMO_TYPE)) {
              propTypes = type.propTypes;
            } else {
              return;
            }
            if (propTypes) {
              var name = getComponentNameFromType(type);
              checkPropTypes(propTypes, element.props, "prop", name, element);
            } else if (type.PropTypes !== void 0 && !propTypesMisspellWarningShown) {
              propTypesMisspellWarningShown = true;
              var _name = getComponentNameFromType(type);
              error("Component %s declared `PropTypes` instead of `propTypes`. Did you misspell the property assignment?", _name || "Unknown");
            }
            if (typeof type.getDefaultProps === "function" && !type.getDefaultProps.isReactClassApproved) {
              error("getDefaultProps is only used on classic React.createClass definitions. Use a static property named `defaultProps` instead.");
            }
          }
        }
        function validateFragmentProps(fragment) {
          {
            var keys = Object.keys(fragment.props);
            for (var i = 0; i < keys.length; i++) {
              var key = keys[i];
              if (key !== "children" && key !== "key") {
                setCurrentlyValidatingElement$1(fragment);
                error("Invalid prop `%s` supplied to `React.Fragment`. React.Fragment can only have `key` and `children` props.", key);
                setCurrentlyValidatingElement$1(null);
                break;
              }
            }
            if (fragment.ref !== null) {
              setCurrentlyValidatingElement$1(fragment);
              error("Invalid attribute `ref` supplied to `React.Fragment`.");
              setCurrentlyValidatingElement$1(null);
            }
          }
        }
        function createElementWithValidation(type, props, children) {
          var validType = isValidElementType(type);
          if (!validType) {
            var info = "";
            if (type === void 0 || typeof type === "object" && type !== null && Object.keys(type).length === 0) {
              info += " You likely forgot to export your component from the file it's defined in, or you might have mixed up default and named imports.";
            }
            var sourceInfo = getSourceInfoErrorAddendumForProps(props);
            if (sourceInfo) {
              info += sourceInfo;
            } else {
              info += getDeclarationErrorAddendum();
            }
            var typeString;
            if (type === null) {
              typeString = "null";
            } else if (isArray(type)) {
              typeString = "array";
            } else if (type !== void 0 && type.$$typeof === REACT_ELEMENT_TYPE) {
              typeString = "<" + (getComponentNameFromType(type.type) || "Unknown") + " />";
              info = " Did you accidentally export a JSX literal instead of a component?";
            } else {
              typeString = typeof type;
            }
            {
              error("React.createElement: type is invalid -- expected a string (for built-in components) or a class/function (for composite components) but got: %s.%s", typeString, info);
            }
          }
          var element = createElement.apply(this, arguments);
          if (element == null) {
            return element;
          }
          if (validType) {
            for (var i = 2; i < arguments.length; i++) {
              validateChildKeys(arguments[i], type);
            }
          }
          if (type === REACT_FRAGMENT_TYPE) {
            validateFragmentProps(element);
          } else {
            validatePropTypes(element);
          }
          return element;
        }
        var didWarnAboutDeprecatedCreateFactory = false;
        function createFactoryWithValidation(type) {
          var validatedFactory = createElementWithValidation.bind(null, type);
          validatedFactory.type = type;
          {
            if (!didWarnAboutDeprecatedCreateFactory) {
              didWarnAboutDeprecatedCreateFactory = true;
              warn("React.createFactory() is deprecated and will be removed in a future major release. Consider using JSX or use React.createElement() directly instead.");
            }
            Object.defineProperty(validatedFactory, "type", {
              enumerable: false,
              get: function() {
                warn("Factory.type is deprecated. Access the class directly before passing it to createFactory.");
                Object.defineProperty(this, "type", {
                  value: type
                });
                return type;
              }
            });
          }
          return validatedFactory;
        }
        function cloneElementWithValidation(element, props, children) {
          var newElement = cloneElement.apply(this, arguments);
          for (var i = 2; i < arguments.length; i++) {
            validateChildKeys(arguments[i], newElement.type);
          }
          validatePropTypes(newElement);
          return newElement;
        }
        function startTransition(scope, options) {
          var prevTransition = ReactCurrentBatchConfig.transition;
          ReactCurrentBatchConfig.transition = {};
          var currentTransition = ReactCurrentBatchConfig.transition;
          {
            ReactCurrentBatchConfig.transition._updatedFibers = /* @__PURE__ */ new Set();
          }
          try {
            scope();
          } finally {
            ReactCurrentBatchConfig.transition = prevTransition;
            {
              if (prevTransition === null && currentTransition._updatedFibers) {
                var updatedFibersCount = currentTransition._updatedFibers.size;
                if (updatedFibersCount > 10) {
                  warn("Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table.");
                }
                currentTransition._updatedFibers.clear();
              }
            }
          }
        }
        var didWarnAboutMessageChannel = false;
        var enqueueTaskImpl = null;
        function enqueueTask(task) {
          if (enqueueTaskImpl === null) {
            try {
              var requireString = ("require" + Math.random()).slice(0, 7);
              var nodeRequire = module2 && module2[requireString];
              enqueueTaskImpl = nodeRequire.call(module2, "timers").setImmediate;
            } catch (_err) {
              enqueueTaskImpl = function(callback) {
                {
                  if (didWarnAboutMessageChannel === false) {
                    didWarnAboutMessageChannel = true;
                    if (typeof MessageChannel === "undefined") {
                      error("This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning.");
                    }
                  }
                }
                var channel = new MessageChannel();
                channel.port1.onmessage = callback;
                channel.port2.postMessage(void 0);
              };
            }
          }
          return enqueueTaskImpl(task);
        }
        var actScopeDepth = 0;
        var didWarnNoAwaitAct = false;
        function act(callback) {
          {
            var prevActScopeDepth = actScopeDepth;
            actScopeDepth++;
            if (ReactCurrentActQueue.current === null) {
              ReactCurrentActQueue.current = [];
            }
            var prevIsBatchingLegacy = ReactCurrentActQueue.isBatchingLegacy;
            var result;
            try {
              ReactCurrentActQueue.isBatchingLegacy = true;
              result = callback();
              if (!prevIsBatchingLegacy && ReactCurrentActQueue.didScheduleLegacyUpdate) {
                var queue = ReactCurrentActQueue.current;
                if (queue !== null) {
                  ReactCurrentActQueue.didScheduleLegacyUpdate = false;
                  flushActQueue(queue);
                }
              }
            } catch (error2) {
              popActScope(prevActScopeDepth);
              throw error2;
            } finally {
              ReactCurrentActQueue.isBatchingLegacy = prevIsBatchingLegacy;
            }
            if (result !== null && typeof result === "object" && typeof result.then === "function") {
              var thenableResult = result;
              var wasAwaited = false;
              var thenable = {
                then: function(resolve, reject) {
                  wasAwaited = true;
                  thenableResult.then(function(returnValue2) {
                    popActScope(prevActScopeDepth);
                    if (actScopeDepth === 0) {
                      recursivelyFlushAsyncActWork(returnValue2, resolve, reject);
                    } else {
                      resolve(returnValue2);
                    }
                  }, function(error2) {
                    popActScope(prevActScopeDepth);
                    reject(error2);
                  });
                }
              };
              {
                if (!didWarnNoAwaitAct && typeof Promise !== "undefined") {
                  Promise.resolve().then(function() {
                  }).then(function() {
                    if (!wasAwaited) {
                      didWarnNoAwaitAct = true;
                      error("You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);");
                    }
                  });
                }
              }
              return thenable;
            } else {
              var returnValue = result;
              popActScope(prevActScopeDepth);
              if (actScopeDepth === 0) {
                var _queue = ReactCurrentActQueue.current;
                if (_queue !== null) {
                  flushActQueue(_queue);
                  ReactCurrentActQueue.current = null;
                }
                var _thenable = {
                  then: function(resolve, reject) {
                    if (ReactCurrentActQueue.current === null) {
                      ReactCurrentActQueue.current = [];
                      recursivelyFlushAsyncActWork(returnValue, resolve, reject);
                    } else {
                      resolve(returnValue);
                    }
                  }
                };
                return _thenable;
              } else {
                var _thenable2 = {
                  then: function(resolve, reject) {
                    resolve(returnValue);
                  }
                };
                return _thenable2;
              }
            }
          }
        }
        function popActScope(prevActScopeDepth) {
          {
            if (prevActScopeDepth !== actScopeDepth - 1) {
              error("You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. ");
            }
            actScopeDepth = prevActScopeDepth;
          }
        }
        function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
          {
            var queue = ReactCurrentActQueue.current;
            if (queue !== null) {
              try {
                flushActQueue(queue);
                enqueueTask(function() {
                  if (queue.length === 0) {
                    ReactCurrentActQueue.current = null;
                    resolve(returnValue);
                  } else {
                    recursivelyFlushAsyncActWork(returnValue, resolve, reject);
                  }
                });
              } catch (error2) {
                reject(error2);
              }
            } else {
              resolve(returnValue);
            }
          }
        }
        var isFlushing = false;
        function flushActQueue(queue) {
          {
            if (!isFlushing) {
              isFlushing = true;
              var i = 0;
              try {
                for (; i < queue.length; i++) {
                  var callback = queue[i];
                  do {
                    callback = callback(true);
                  } while (callback !== null);
                }
                queue.length = 0;
              } catch (error2) {
                queue = queue.slice(i + 1);
                throw error2;
              } finally {
                isFlushing = false;
              }
            }
          }
        }
        var createElement$1 = createElementWithValidation;
        var cloneElement$1 = cloneElementWithValidation;
        var createFactory = createFactoryWithValidation;
        var Children = {
          map: mapChildren,
          forEach: forEachChildren,
          count: countChildren,
          toArray,
          only: onlyChild
        };
        exports2.Children = Children;
        exports2.Component = Component;
        exports2.Fragment = REACT_FRAGMENT_TYPE;
        exports2.Profiler = REACT_PROFILER_TYPE;
        exports2.PureComponent = PureComponent;
        exports2.StrictMode = REACT_STRICT_MODE_TYPE;
        exports2.Suspense = REACT_SUSPENSE_TYPE;
        exports2.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = ReactSharedInternals;
        exports2.act = act;
        exports2.cloneElement = cloneElement$1;
        exports2.createContext = createContext;
        exports2.createElement = createElement$1;
        exports2.createFactory = createFactory;
        exports2.createRef = createRef;
        exports2.forwardRef = forwardRef;
        exports2.isValidElement = isValidElement;
        exports2.lazy = lazy;
        exports2.memo = memo;
        exports2.startTransition = startTransition;
        exports2.unstable_act = act;
        exports2.useCallback = useCallback;
        exports2.useContext = useContext;
        exports2.useDebugValue = useDebugValue;
        exports2.useDeferredValue = useDeferredValue;
        exports2.useEffect = useEffect;
        exports2.useId = useId;
        exports2.useImperativeHandle = useImperativeHandle;
        exports2.useInsertionEffect = useInsertionEffect;
        exports2.useLayoutEffect = useLayoutEffect;
        exports2.useMemo = useMemo;
        exports2.useReducer = useReducer;
        exports2.useRef = useRef;
        exports2.useState = useState;
        exports2.useSyncExternalStore = useSyncExternalStore;
        exports2.useTransition = useTransition;
        exports2.version = ReactVersion;
        if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ !== "undefined" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop === "function") {
          __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(new Error());
        }
      })();
    }
  }
});

// node_modules/react/index.js
var require_react = __commonJS({
  "node_modules/react/index.js"(exports2, module2) {
    "use strict";
    if (process.env.NODE_ENV === "production") {
      module2.exports = require_react_production_min();
    } else {
      module2.exports = require_react_development();
    }
  }
});

// node_modules/next/dist/client/components/hooks-server-context.js
var require_hooks_server_context = __commonJS({
  "node_modules/next/dist/client/components/hooks-server-context.js"(exports2, module2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    _export(exports2, {
      DynamicServerError: function() {
        return DynamicServerError;
      },
      isDynamicServerError: function() {
        return isDynamicServerError;
      }
    });
    var DYNAMIC_ERROR_CODE = "DYNAMIC_SERVER_USAGE";
    var DynamicServerError = class extends Error {
      constructor(description) {
        super(`Dynamic server usage: ${description}`), this.description = description, this.digest = DYNAMIC_ERROR_CODE;
      }
    };
    function isDynamicServerError(err) {
      if (typeof err !== "object" || err === null || !("digest" in err) || typeof err.digest !== "string") {
        return false;
      }
      return err.digest === DYNAMIC_ERROR_CODE;
    }
    if ((typeof exports2.default === "function" || typeof exports2.default === "object" && exports2.default !== null) && typeof exports2.default.__esModule === "undefined") {
      Object.defineProperty(exports2.default, "__esModule", { value: true });
      Object.assign(exports2.default, exports2);
      module2.exports = exports2.default;
    }
  }
});

// node_modules/next/dist/client/components/static-generation-bailout.js
var require_static_generation_bailout = __commonJS({
  "node_modules/next/dist/client/components/static-generation-bailout.js"(exports2, module2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    _export(exports2, {
      StaticGenBailoutError: function() {
        return StaticGenBailoutError;
      },
      isStaticGenBailoutError: function() {
        return isStaticGenBailoutError;
      }
    });
    var NEXT_STATIC_GEN_BAILOUT = "NEXT_STATIC_GEN_BAILOUT";
    var StaticGenBailoutError = class extends Error {
      constructor(...args) {
        super(...args), this.code = NEXT_STATIC_GEN_BAILOUT;
      }
    };
    function isStaticGenBailoutError(error) {
      if (typeof error !== "object" || error === null || !("code" in error)) {
        return false;
      }
      return error.code === NEXT_STATIC_GEN_BAILOUT;
    }
    if ((typeof exports2.default === "function" || typeof exports2.default === "object" && exports2.default !== null) && typeof exports2.default.__esModule === "undefined") {
      Object.defineProperty(exports2.default, "__esModule", { value: true });
      Object.assign(exports2.default, exports2);
      module2.exports = exports2.default;
    }
  }
});

// node_modules/next/dist/shared/lib/promise-with-resolvers.js
var require_promise_with_resolvers = __commonJS({
  "node_modules/next/dist/shared/lib/promise-with-resolvers.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    Object.defineProperty(exports2, "createPromiseWithResolvers", {
      enumerable: true,
      get: function() {
        return createPromiseWithResolvers;
      }
    });
    function createPromiseWithResolvers() {
      let resolve;
      let reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return {
        resolve,
        reject,
        promise
      };
    }
  }
});

// node_modules/next/dist/server/app-render/staged-rendering.js
var require_staged_rendering = __commonJS({
  "node_modules/next/dist/server/app-render/staged-rendering.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    _export(exports2, {
      RENDER_STAGE_ADVANCE_ORDER: function() {
        return RENDER_STAGE_ADVANCE_ORDER;
      },
      RenderStage: function() {
        return RenderStage;
      },
      StagedRenderingController: function() {
        return StagedRenderingController;
      },
      SyncIOMode: function() {
        return SyncIOMode;
      },
      getNextStage: function() {
        return getNextStage;
      },
      isAdvanceableRenderStage: function() {
        return isAdvanceableRenderStage;
      }
    });
    var _invarianterror = require_invariant_error();
    var _promisewithresolvers = require_promise_with_resolvers();
    var RenderStage = /* @__PURE__ */ function(RenderStage2) {
      RenderStage2[RenderStage2["Before"] = 1] = "Before";
      RenderStage2[RenderStage2["ShellStatic"] = 11] = "ShellStatic";
      RenderStage2[RenderStage2["Static"] = 13] = "Static";
      RenderStage2[RenderStage2["ShellRuntime"] = 21] = "ShellRuntime";
      RenderStage2[RenderStage2["Runtime"] = 23] = "Runtime";
      RenderStage2[RenderStage2["Dynamic"] = 30] = "Dynamic";
      RenderStage2[RenderStage2["Abandoned"] = 40] = "Abandoned";
      return RenderStage2;
    }({});
    var RENDER_STAGE_ADVANCE_ORDER = [
      11,
      13,
      21,
      23,
      30
    ];
    function getNextStage(stage) {
      return RENDER_STAGE_ADVANCE_ORDER[RENDER_STAGE_ADVANCE_ORDER.indexOf(stage) + 1];
    }
    function isAdvanceableRenderStage(stage) {
      return 1 < stage && stage <= 30;
    }
    var SyncIOMode = /* @__PURE__ */ function(SyncIOMode2) {
      SyncIOMode2[SyncIOMode2["Untracked"] = 1] = "Untracked";
      SyncIOMode2[SyncIOMode2["AllowedInRuntimeOrDynamic"] = 2] = "AllowedInRuntimeOrDynamic";
      SyncIOMode2[SyncIOMode2["AllowedInDynamic"] = 3] = "AllowedInDynamic";
      return SyncIOMode2;
    }({});
    var StagedRenderingController = class {
      constructor({ abortSignal, abandonController, syncIO, finalStage }) {
        this.currentStage = 1;
        this.syncInterruptReason = null;
        this.triggers = {
          [11]: createStageTrigger(),
          [13]: createStageTrigger(),
          //
          [21]: createStageTrigger(),
          [23]: createStageTrigger(),
          //
          [30]: createStageTrigger()
        };
        this.abortSignal = abortSignal;
        this.abandonController = abandonController;
        this.syncIOMode = syncIO;
        this.finalStage = finalStage;
        if (abortSignal) {
          abortSignal.addEventListener("abort", () => {
            const { reason } = abortSignal;
            for (const trigger of Object.values(this.triggers)) {
              cancelStageTrigger(trigger, reason);
            }
          }, {
            once: true
          });
        }
        if (abandonController) {
          abandonController.signal.addEventListener("abort", () => {
            this.abandonRender();
          }, {
            once: true
          });
        }
      }
      onStage(stage, callback) {
        addSyncTriggerListener(this.triggers[stage], callback);
      }
      shouldTrackSyncInterrupt() {
        if (this.syncIOMode === 1) {
          return false;
        }
        switch (this.currentStage) {
          case 1:
            return false;
          case 11:
          case 13:
            return true;
          case 21:
          case 23: {
            switch (this.syncIOMode) {
              case 2: {
                return false;
              }
              case 3: {
                return true;
              }
            }
          }
          case 30:
          case 40:
            return false;
          default:
            this.currentStage;
            return false;
        }
      }
      /** Note: only call this if `shouldTrackSyncInterrupt()` returned true */
      syncInterruptCurrentStageWithReason(reason) {
        const { currentStage } = this;
        if (currentStage === 1 || currentStage === 30 || currentStage === 40) {
          return;
        }
        if (this.abandonController) {
          this.abandonController.abort();
          return;
        }
        if (this.abortSignal) {
          this.syncInterruptReason = reason;
          this.currentStage = 40;
          return;
        }
        this.syncInterruptReason = reason;
        this.advanceStage(30);
      }
      getSyncInterruptReason() {
        return this.syncInterruptReason;
      }
      getStageEndTime(stage) {
        return this.triggers[getNextStage(stage)].triggeredAt ?? Infinity;
      }
      abandonRender() {
        const { currentStage } = this;
        if (currentStage === 1) {
          throw Object.defineProperty(new _invarianterror.InvariantError("A render that hasn't started yet cannot be abandoned"), "__NEXT_ERROR_CODE", {
            value: "E1300",
            enumerable: false,
            configurable: true
          });
        }
        if (currentStage === 30 || currentStage === 40) {
          return;
        }
        const nextStageIx = RENDER_STAGE_ADVANCE_ORDER.indexOf(currentStage) + 1;
        const dynamicStageIx = RENDER_STAGE_ADVANCE_ORDER.indexOf(30);
        for (let i = nextStageIx; i < dynamicStageIx; i++) {
          this.resolveStage(RENDER_STAGE_ADVANCE_ORDER[i]);
        }
        this.currentStage = 40;
      }
      advanceStage(targetStage) {
        if (this.finalStage !== null && targetStage > this.finalStage) {
          throw Object.defineProperty(new _invarianterror.InvariantError(`Attempted to advance to stage ${RenderStage[targetStage]} but the render is limited to ${RenderStage[this.finalStage]}`), "__NEXT_ERROR_CODE", {
            value: "E1302",
            enumerable: false,
            configurable: true
          });
        }
        const { currentStage } = this;
        if (currentStage === 30 || currentStage === 40) {
          return;
        }
        if (targetStage <= currentStage) {
          return;
        }
        this.currentStage = targetStage;
        const nextStageIx = currentStage === 1 ? 0 : RENDER_STAGE_ADVANCE_ORDER.indexOf(currentStage) + 1;
        const targetStageIx = RENDER_STAGE_ADVANCE_ORDER.indexOf(targetStage);
        for (let i = nextStageIx; i <= targetStageIx; i++) {
          this.resolveStage(RENDER_STAGE_ADVANCE_ORDER[i]);
        }
      }
      resolveStage(stage) {
        fireStageTrigger(this.triggers[stage]);
      }
      getStagePromise(stage) {
        return this.triggers[stage].promise;
      }
      waitForStage(stage) {
        return this.getStagePromise(stage);
      }
      delayUntilStage(stage, displayName, resolvedValue) {
        const stagePromise = this.getStagePromise(stage);
        const promise = process.env.NODE_ENV === "development" ? makeDevtoolsIOPromiseFromIOTrigger(stagePromise, displayName, resolvedValue) : stagePromise.then(() => resolvedValue);
        if (this.abortSignal) {
          promise.catch(ignoreReject);
        }
        return promise;
      }
    };
    function ignoreReject() {
    }
    function makeDevtoolsIOPromiseFromIOTrigger(ioTrigger, displayName, resolvedValue) {
      const promise = new Promise((resolve, reject) => {
        ioTrigger.then(resolve.bind(null, resolvedValue), reject);
      });
      if (displayName !== void 0) {
        promise.displayName = displayName;
      }
      return promise;
    }
    function addSyncTriggerListener(trigger, listener) {
      if (trigger.state === "pending") {
        trigger._listeners.push(listener);
      } else {
        listener();
      }
    }
    function createStageTrigger() {
      const { promise, resolve, reject } = (0, _promisewithresolvers.createPromiseWithResolvers)();
      return {
        state: "pending",
        triggeredAt: null,
        promise,
        _listeners: [],
        _resolvePromise: resolve,
        _rejectPromise: reject
      };
    }
    function fireStageTrigger(trigger) {
      if (trigger.state !== "pending") {
        return;
      }
      trigger.state = "triggered";
      trigger.triggeredAt = performance.now() + performance.timeOrigin;
      try {
        const { _listeners: listeners } = trigger;
        for (let i = 0; i < listeners.length; i++) {
          listeners[i]();
        }
        listeners.length = 0;
      } finally {
        trigger._resolvePromise();
      }
    }
    function cancelStageTrigger(trigger, reason) {
      if (trigger.state !== "pending") {
        return;
      }
      trigger.state = "cancelled";
      trigger._listeners.length = 0;
      trigger.promise.catch(ignoreReject);
      trigger._rejectPromise(reason);
    }
  }
});

// node_modules/next/dist/server/runtime-reacts.external.js
var require_runtime_reacts_external = __commonJS({
  "node_modules/next/dist/server/runtime-reacts.external.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    _export(exports2, {
      getClientReact: function() {
        return getClientReact;
      },
      getServerReact: function() {
        return getServerReact;
      },
      registerClientReact: function() {
        return registerClientReact;
      },
      registerServerReact: function() {
        return registerServerReact;
      }
    });
    var ClientReact = null;
    function registerClientReact(react) {
      ClientReact = react;
    }
    function getClientReact() {
      return ClientReact;
    }
    var ServerReact = null;
    function registerServerReact(react) {
      ServerReact = react;
    }
    function getServerReact() {
      return ServerReact;
    }
  }
});

// node_modules/next/dist/server/dynamic-rendering-utils.js
var require_dynamic_rendering_utils = __commonJS({
  "node_modules/next/dist/server/dynamic-rendering-utils.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    _export(exports2, {
      ClientHookDynamicError: function() {
        return ClientHookDynamicError;
      },
      RENDER_STAGES_BY_DATA_KIND: function() {
        return RENDER_STAGES_BY_DATA_KIND;
      },
      applyOwnerStack: function() {
        return applyOwnerStack;
      },
      isClientHookDynamicError: function() {
        return isClientHookDynamicError;
      },
      isHangingPromiseRejectionError: function() {
        return isHangingPromiseRejectionError;
      },
      makeClientHookHangingPromise: function() {
        return makeClientHookHangingPromise;
      },
      makeDevtoolsIOAwarePromise: function() {
        return makeDevtoolsIOAwarePromise;
      },
      makeDynamicHangingPromise: function() {
        return makeDynamicHangingPromise;
      },
      makeFallbackParamsHangingPromise: function() {
        return makeFallbackParamsHangingPromise;
      },
      makePromiseFromTrigger: function() {
        return makePromiseFromTrigger;
      },
      makeRuntimeHangingPromise: function() {
        return makeRuntimeHangingPromise;
      },
      makeStageHangingPromise: function() {
        return makeStageHangingPromise;
      },
      makeUntrackedHangingPromise: function() {
        return makeUntrackedHangingPromise;
      },
      trackFallbackParamsAccessed: function() {
        return trackFallbackParamsAccessed;
      },
      trackRuntimeDataAccessed: function() {
        return trackRuntimeDataAccessed;
      }
    });
    var _stagedrendering = require_staged_rendering();
    var _workunitasyncstorageexternal = require_work_unit_async_storage_external();
    var _runtimereactsexternal = require_runtime_reacts_external();
    function isHangingPromiseRejectionError(err) {
      if (typeof err !== "object" || err === null || !("digest" in err)) {
        return false;
      }
      return err.digest === HANGING_PROMISE_REJECTION;
    }
    var HANGING_PROMISE_REJECTION = "HANGING_PROMISE_REJECTION";
    var HangingPromiseRejectionError = class extends Error {
      constructor(route, expression) {
        super(`During prerendering, ${expression} rejects when the prerender is complete. Typically these errors are handled by React but if you move ${expression} to a different context by using \`setTimeout\`, \`after\`, or similar functions you may observe this error and you should handle it in that context. This occurred at route "${route}".`), this.route = route, this.expression = expression, this.digest = HANGING_PROMISE_REJECTION;
      }
    };
    var CLIENT_HOOK_DYNAMIC = "CLIENT_HOOK_DYNAMIC";
    var ClientHookDynamicError = class extends Error {
      constructor(route, expression) {
        super(`Route "${route}": Next.js encountered URL data \`${expression}\` in a Client Component outside of \`<Suspense>\`.

This blocks prerendering because the value is only available at runtime.

Ways to fix this:
  - [stream] Wrap the component in \`<Suspense fallback={...}>\` so the hook value streams in after prerendering
  - [block] Set \`export const instant = false\` to allow a blocking route

Learn more: https://nextjs.org/docs/messages/blocking-prerender-client-hook`), this.digest = CLIENT_HOOK_DYNAMIC;
        Object.defineProperty(this, "__NEXT_ERROR_CODE", {
          value: "E1433",
          enumerable: false,
          configurable: true
        });
      }
    };
    function isClientHookDynamicError(err) {
      if (typeof err !== "object" || err === null || !("digest" in err)) {
        return false;
      }
      return err.digest === CLIENT_HOOK_DYNAMIC;
    }
    var abortListenersBySignal = /* @__PURE__ */ new WeakMap();
    function makeDynamicHangingPromise(signal, route, expression) {
      return makeHangingPromiseWithError(signal, new HangingPromiseRejectionError(route, expression));
    }
    function makeUntrackedHangingPromise(signal, route, expression) {
      return makeHangingPromiseWithError(signal, new HangingPromiseRejectionError(route, expression));
    }
    function makeRuntimeHangingPromise(signal, route, expression, workUnitStore) {
      if (workUnitStore !== null) {
        trackRuntimeDataAccessed(workUnitStore);
      }
      return makeHangingPromiseWithError(signal, new HangingPromiseRejectionError(route, expression));
    }
    function makeFallbackParamsHangingPromise(signal, route, expression, workUnitStore) {
      if (workUnitStore !== null) {
        trackFallbackParamsAccessed(workUnitStore);
      }
      return makeHangingPromiseWithError(signal, new HangingPromiseRejectionError(route, expression));
    }
    function makeStageHangingPromise(signal, route, expression, workUnitStore) {
      trackRuntimeDataAccessed(workUnitStore);
      return makeHangingPromiseWithError(signal, new HangingPromiseRejectionError(route, expression));
    }
    function trackRuntimeDataAccessed(workUnitStore) {
      trackRuntimeDataAccessedImpl(workUnitStore, false);
    }
    function trackFallbackParamsAccessed(workUnitStore) {
      trackRuntimeDataAccessedImpl(workUnitStore, true);
    }
    function trackRuntimeDataAccessedImpl(workUnitStore, isFallbackParamAccess) {
      switch (workUnitStore.type) {
        case "prerender": {
          var _workUnitStore_runtimeDataAccessed;
          (_workUnitStore_runtimeDataAccessed = workUnitStore.runtimeDataAccessed) == null ? void 0 : _workUnitStore_runtimeDataAccessed.resolve(true);
          const hintCell = workUnitStore.shouldAttemptStaticPrefetch;
          if (hintCell !== null && (!isFallbackParamAccess || !workUnitStore.isFallbackUpgradeable)) {
            hintCell.current = false;
          }
          break;
        }
        case "prerender-client":
        case "prerender-ppr":
        case "prerender-legacy":
        case "prerender-runtime":
        case "validation-client":
        case "request":
        case "cache":
        case "private-cache":
        case "unstable-cache":
        case "generate-static-params":
          break;
        default:
          workUnitStore;
      }
    }
    function makeClientHookHangingPromise(signal, error) {
      return makeHangingPromiseWithError(signal, error);
    }
    function makeHangingPromiseWithError(signal, error) {
      if (signal.aborted) {
        return Promise.reject(error);
      } else {
        const hangingPromise = new Promise((_, reject) => {
          const boundRejection = reject.bind(null, error);
          let currentListeners = abortListenersBySignal.get(signal);
          if (currentListeners) {
            currentListeners.push(boundRejection);
          } else {
            const listeners = [
              boundRejection
            ];
            abortListenersBySignal.set(signal, listeners);
            signal.addEventListener("abort", () => {
              for (let i = 0; i < listeners.length; i++) {
                listeners[i]();
              }
            }, {
              once: true
            });
          }
        });
        hangingPromise.catch(ignoreReject);
        return hangingPromise;
      }
    }
    function ignoreReject() {
    }
    function makePromiseFromTrigger(trigger, value) {
      const promise = trigger.then(() => value);
      promise.catch(ignoreReject);
      return promise;
    }
    function makeDevtoolsIOAwarePromise(underlying, requestStore, stage) {
      if (requestStore.stagedRendering) {
        return requestStore.stagedRendering.delayUntilStage(stage, void 0, underlying);
      }
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(underlying);
        }, 0);
      });
    }
    var RENDER_STAGES_BY_DATA_KIND = {
      sessionData: _stagedrendering.RenderStage.ShellRuntime,
      staticLinkData: _stagedrendering.RenderStage.Static,
      runtimeLinkData: _stagedrendering.RenderStage.Runtime
    };
    function applyOwnerStack(error) {
      if (process.env.NODE_ENV !== "production") {
        var _getClientReact_captureOwnerStack, _getClientReact, _getServerReact_captureOwnerStack, _getServerReact;
        let ownerStack;
        const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
        const innerOwnerStack = ((_getClientReact = (0, _runtimereactsexternal.getClientReact)()) == null ? void 0 : (_getClientReact_captureOwnerStack = _getClientReact.captureOwnerStack) == null ? void 0 : _getClientReact_captureOwnerStack.call(_getClientReact)) ?? ((_getServerReact = (0, _runtimereactsexternal.getServerReact)()) == null ? void 0 : (_getServerReact_captureOwnerStack = _getServerReact.captureOwnerStack) == null ? void 0 : _getServerReact_captureOwnerStack.call(_getServerReact));
        switch (workUnitStore == null ? void 0 : workUnitStore.type) {
          case "cache":
          case "private-cache":
            ownerStack = (innerOwnerStack || "") + (workUnitStore.outerOwnerStack || "") || void 0;
            break;
          case "unstable-cache":
          case "request":
          case "prerender":
          case "prerender-ppr":
          case "prerender-legacy":
          case "prerender-runtime":
          case "prerender-client":
          case "validation-client":
          case "generate-static-params":
          case void 0:
            ownerStack = innerOwnerStack;
            break;
          default:
            workUnitStore;
        }
        if (ownerStack) {
          let stack = ownerStack;
          if (error.stack) {
            const frames = [];
            for (const frame of error.stack.split("\n").slice(1)) {
              if (frame.includes("react_stack_bottom_frame")) {
                break;
              }
              frames.push(frame);
            }
            stack = "\n" + frames.join("\n") + stack;
          }
          error.stack = error.name + ": " + error.message + stack;
        }
      }
      return error;
    }
  }
});

// node_modules/next/dist/lib/framework/boundary-constants.js
var require_boundary_constants = __commonJS({
  "node_modules/next/dist/lib/framework/boundary-constants.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    _export(exports2, {
      METADATA_BOUNDARY_NAME: function() {
        return METADATA_BOUNDARY_NAME;
      },
      OUTLET_BOUNDARY_NAME: function() {
        return OUTLET_BOUNDARY_NAME;
      },
      ROOT_LAYOUT_BOUNDARY_NAME: function() {
        return ROOT_LAYOUT_BOUNDARY_NAME;
      },
      VIEWPORT_BOUNDARY_NAME: function() {
        return VIEWPORT_BOUNDARY_NAME;
      }
    });
    var METADATA_BOUNDARY_NAME = "__next_metadata_boundary__";
    var VIEWPORT_BOUNDARY_NAME = "__next_viewport_boundary__";
    var OUTLET_BOUNDARY_NAME = "__next_outlet_boundary__";
    var ROOT_LAYOUT_BOUNDARY_NAME = "__next_root_layout_boundary__";
  }
});

// node_modules/next/dist/lib/scheduler.js
var require_scheduler = __commonJS({
  "node_modules/next/dist/lib/scheduler.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    _export(exports2, {
      atLeastOneTask: function() {
        return atLeastOneTask;
      },
      scheduleImmediate: function() {
        return scheduleImmediate;
      },
      scheduleOnNextTick: function() {
        return scheduleOnNextTick;
      },
      waitAtLeastOneReactRenderTask: function() {
        return waitAtLeastOneReactRenderTask;
      }
    });
    var scheduleOnNextTick = (cb) => {
      Promise.resolve().then(() => {
        if (process.env.NEXT_RUNTIME === "edge") {
          setTimeout(cb, 0);
        } else {
          process.nextTick(cb);
        }
      });
    };
    var scheduleImmediate = (cb) => {
      if (process.env.NEXT_RUNTIME === "edge") {
        setTimeout(cb, 0);
      } else {
        setImmediate(cb);
      }
    };
    function atLeastOneTask() {
      return new Promise((resolve) => scheduleImmediate(resolve));
    }
    function waitAtLeastOneReactRenderTask() {
      if (process.env.NEXT_RUNTIME === "edge") {
        return new Promise((r) => setTimeout(r, 0));
      } else {
        return new Promise((r) => setImmediate(r));
      }
    }
  }
});

// node_modules/next/dist/shared/lib/lazy-dynamic/bailout-to-csr.js
var require_bailout_to_csr = __commonJS({
  "node_modules/next/dist/shared/lib/lazy-dynamic/bailout-to-csr.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    _export(exports2, {
      BailoutToCSRError: function() {
        return BailoutToCSRError;
      },
      isBailoutToCSRError: function() {
        return isBailoutToCSRError;
      }
    });
    var BAILOUT_TO_CSR = "BAILOUT_TO_CLIENT_SIDE_RENDERING";
    var BailoutToCSRError = class extends Error {
      constructor(reason) {
        super(`Bail out to client-side rendering: ${reason}`), this.reason = reason, this.digest = BAILOUT_TO_CSR;
      }
    };
    function isBailoutToCSRError(err) {
      if (typeof err !== "object" || err === null || !("digest" in err)) {
        return false;
      }
      return err.digest === BAILOUT_TO_CSR;
    }
  }
});

// node_modules/next/dist/server/app-render/blocking-route-messages.js
var require_blocking_route_messages = __commonJS({
  "node_modules/next/dist/server/app-render/blocking-route-messages.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    _export(exports2, {
      createDynamicBodyError: function() {
        return createDynamicBodyError;
      },
      createDynamicBodyErrorInNavigation: function() {
        return createDynamicBodyErrorInNavigation;
      },
      createDynamicMetadataError: function() {
        return createDynamicMetadataError;
      },
      createDynamicOrRuntimeBodyError: function() {
        return createDynamicOrRuntimeBodyError;
      },
      createDynamicOrRuntimeMetadataError: function() {
        return createDynamicOrRuntimeMetadataError;
      },
      createDynamicOrRuntimeViewportError: function() {
        return createDynamicOrRuntimeViewportError;
      },
      createDynamicViewportError: function() {
        return createDynamicViewportError;
      },
      createLinkBodyErrorInNavigation: function() {
        return createLinkBodyErrorInNavigation;
      },
      createLinkMetadataError: function() {
        return createLinkMetadataError;
      },
      createLinkViewportError: function() {
        return createLinkViewportError;
      },
      createRuntimeBodyError: function() {
        return createRuntimeBodyError;
      },
      createRuntimeBodyErrorInNavigation: function() {
        return createRuntimeBodyErrorInNavigation;
      },
      createRuntimeMetadataError: function() {
        return createRuntimeMetadataError;
      },
      createRuntimeViewportError: function() {
        return createRuntimeViewportError;
      },
      logBuildDebugHint: function() {
        return logBuildDebugHint;
      }
    });
    function createRuntimeBodyError(route) {
      return Object.defineProperty(new Error(`Route "${route}": Next.js encountered runtime data during prerendering.

\`cookies()\`, \`headers()\`, \`params\`, or \`searchParams\` accessed outside of \`<Suspense>\` prevents the route from being prerendered, blocking the page load and leading to a slower user experience.

Ways to fix this:
  - [stream] Provide a placeholder with \`<Suspense fallback={...}>\` around the data access
  - [block] Set \`export const instant = false\` to allow a blocking route

Learn more: https://nextjs.org/docs/messages/blocking-prerender-runtime`), "__NEXT_ERROR_CODE", {
        value: "E1427",
        enumerable: false,
        configurable: true
      });
    }
    function createDynamicBodyError(route) {
      return Object.defineProperty(new Error(`Route "${route}": Next.js encountered uncached data during prerendering.

\`fetch(...)\` or \`connection()\` accessed outside of \`<Suspense>\` prevents the route from being prerendered, blocking the page load and leading to a slower user experience.

Ways to fix this:
  - [stream] Provide a placeholder with \`<Suspense fallback={...}>\` around the data access
  - [cache] Cache the data access with \`"use cache"\` (does not apply to \`connection()\`)
  - [block] Set \`export const instant = false\` to allow a blocking route

Learn more: https://nextjs.org/docs/messages/blocking-prerender-dynamic`), "__NEXT_ERROR_CODE", {
        value: "E1440",
        enumerable: false,
        configurable: true
      });
    }
    function createRuntimeBodyErrorInNavigation(route) {
      return Object.defineProperty(new Error(`Route "${route}": Next.js encountered runtime data during prerendering or a navigation.

\`cookies()\`, \`headers()\`, \`params\`, or \`searchParams\` accessed outside of \`<Suspense>\` prevents the route from being prerendered or the navigation from being instant, leading to a slower user experience.

Ways to fix this:
  - [stream] Provide a placeholder with \`<Suspense fallback={...}>\` around the data access
  - [block] Set \`export const instant = false\` to allow a blocking route

Learn more: https://nextjs.org/docs/messages/blocking-prerender-runtime`), "__NEXT_ERROR_CODE", {
        value: "E1430",
        enumerable: false,
        configurable: true
      });
    }
    function createLinkBodyErrorInNavigation(route) {
      return Object.defineProperty(new Error(`Route "${route}": Next.js encountered URL data during prerendering or a navigation.

\`params\` or \`searchParams\` accessed outside of \`<Suspense>\` may prevent the navigation from being instant, leading to a slower user experience.

Ways to fix this:
  - [stream] Provide a placeholder with \`<Suspense fallback={...}>\` around the data access
  - [block] Set \`export const instant = false\` to allow a blocking route

Learn more: https://nextjs.org/docs/messages/instant-shell-url-data`), "__NEXT_ERROR_CODE", {
        value: "E1439",
        enumerable: false,
        configurable: true
      });
    }
    function createDynamicBodyErrorInNavigation(route) {
      return Object.defineProperty(new Error(`Route "${route}": Next.js encountered uncached data during prerendering or a navigation.

\`fetch(...)\` or \`connection()\` accessed outside of \`<Suspense>\` prevents the route from being prerendered or the navigation from being instant, leading to a slower user experience.

Ways to fix this:
  - [stream] Provide a placeholder with \`<Suspense fallback={...}>\` around the data access
  - [cache] Cache the data access with \`"use cache"\` (does not apply to \`connection()\`)
  - [block] Set \`export const instant = false\` to allow a blocking route

Learn more: https://nextjs.org/docs/messages/blocking-prerender-dynamic`), "__NEXT_ERROR_CODE", {
        value: "E1437",
        enumerable: false,
        configurable: true
      });
    }
    function createDynamicOrRuntimeBodyError(route) {
      return Object.defineProperty(new Error(`Route "${route}": Next.js encountered uncached or runtime data during prerendering.

\`fetch(...)\`, \`cookies()\`, \`headers()\`, \`params\`, \`searchParams\`, or \`connection()\` accessed outside of \`<Suspense>\` prevents the route from being prerendered, blocking the page load and leading to a slower user experience.

Ways to fix this:
  - [stream] Provide a placeholder with \`<Suspense fallback={...}>\` around the data access
  - [cache] For uncached data (\`fetch\`, database calls): cache the access with \`"use cache"\` (does not apply to \`connection()\`)
  - [block] Set \`export const instant = false\` to allow a blocking route

Learn more: https://nextjs.org/docs/messages/blocking-prerender-dynamic`), "__NEXT_ERROR_CODE", {
        value: "E1428",
        enumerable: false,
        configurable: true
      });
    }
    function createLinkMetadataError(route) {
      return Object.defineProperty(new Error(`Route "${route}": Next.js encountered URL data in \`generateMetadata()\`.

This route's metadata is blocked, but the rest of its content can be prefetched. \`params\` or \`searchParams\` accessed in \`generateMetadata()\` prevent it from being prefetched.

Ways to fix this:
  - [static] Use a static metadata export instead of \`generateMetadata()\`
  - [dynamic] Render a marker component that calls \`await connection()\` inside \`<Suspense>\` on the page

Learn more: https://nextjs.org/docs/messages/blocking-prerender-metadata-runtime`), "__NEXT_ERROR_CODE", {
        value: "E1429",
        enumerable: false,
        configurable: true
      });
    }
    function createRuntimeMetadataError(route) {
      return Object.defineProperty(new Error(`Route "${route}": Next.js encountered runtime data in \`generateMetadata()\`.

This route's metadata is blocked, but the rest of its content can be prerendered. \`cookies()\`, \`headers()\`, \`params\`, or \`searchParams\` accessed in \`generateMetadata()\` cause it to run dynamically.

Ways to fix this:
  - [static] Use a static metadata export instead of \`generateMetadata()\`
  - [dynamic] Render a marker component that calls \`await connection()\` inside \`<Suspense>\` on the page

Learn more: https://nextjs.org/docs/messages/blocking-prerender-metadata-runtime`), "__NEXT_ERROR_CODE", {
        value: "E1423",
        enumerable: false,
        configurable: true
      });
    }
    function createDynamicMetadataError(route) {
      return Object.defineProperty(new Error(`Route "${route}": Next.js encountered uncached data in \`generateMetadata()\`.

This route's metadata is blocked, but the rest of its content can be prerendered. \`fetch(...)\` or \`connection()\` accessed in \`generateMetadata()\` cause it to run dynamically.

Ways to fix this:
  - [cache] Cache the metadata with \`"use cache"\` in \`generateMetadata()\` (does not apply to \`connection()\`)
  - [dynamic] Render a marker component that calls \`await connection()\` inside \`<Suspense>\` on the page

Learn more: https://nextjs.org/docs/messages/blocking-prerender-metadata-dynamic`), "__NEXT_ERROR_CODE", {
        value: "E1425",
        enumerable: false,
        configurable: true
      });
    }
    function createLinkViewportError(route) {
      return Object.defineProperty(new Error(`Route "${route}": Next.js encountered URL data in \`generateViewport()\`.

\`params\` or \`searchParams\` in \`generateViewport()\` prevents the page from being prerendered, leading to a slower user experience.

Ways to fix this:
  - [static] Use a static viewport export instead of \`generateViewport()\`
  - [block] Set \`export const instant = false\` to allow a blocking route

Learn more: https://nextjs.org/docs/messages/blocking-prerender-viewport-runtime`), "__NEXT_ERROR_CODE", {
        value: "E1431",
        enumerable: false,
        configurable: true
      });
    }
    function createRuntimeViewportError(route) {
      return Object.defineProperty(new Error(`Route "${route}": Next.js encountered runtime data in \`generateViewport()\`.

\`cookies()\`, \`headers()\`, \`params\`, or \`searchParams\` in \`generateViewport()\` prevents the page from being prerendered, leading to a slower user experience.

Ways to fix this:
  - [static] Use a static viewport export instead of \`generateViewport()\`
  - [block] Set \`export const instant = false\` to allow a blocking route

Learn more: https://nextjs.org/docs/messages/blocking-prerender-viewport-runtime`), "__NEXT_ERROR_CODE", {
        value: "E1424",
        enumerable: false,
        configurable: true
      });
    }
    function createDynamicViewportError(route) {
      return Object.defineProperty(new Error(`Route "${route}": Next.js encountered uncached data in \`generateViewport()\`.

\`fetch(...)\` or \`connection()\` in \`generateViewport()\` prevents the page from being prerendered, leading to a slower user experience.

Ways to fix this:
  - [cache] Cache the viewport data with \`"use cache"\` in \`generateViewport()\` (does not apply to \`connection()\`)
  - [block] Set \`export const instant = false\` to allow a blocking route

Learn more: https://nextjs.org/docs/messages/blocking-prerender-viewport-dynamic`), "__NEXT_ERROR_CODE", {
        value: "E1438",
        enumerable: false,
        configurable: true
      });
    }
    function createDynamicOrRuntimeViewportError(route) {
      return Object.defineProperty(new Error(`Route "${route}": Next.js encountered uncached or runtime data in \`generateViewport()\`.

This prevents the page from being prerendered, leading to a slower user experience. Unlike metadata, viewport cannot be streamed behind \`<Suspense>\` because it affects the initial page load.

Ways to fix this:
  - [static] Use a static viewport export instead of \`generateViewport()\`
  - [cache] For uncached data (\`fetch\`, database calls): cache the viewport with \`"use cache"\` in \`generateViewport()\` (does not apply to \`connection()\`)
  - [block] Set \`export const instant = false\` to allow a blocking route

Learn more: https://nextjs.org/docs/messages/blocking-prerender-viewport-runtime`), "__NEXT_ERROR_CODE", {
        value: "E1436",
        enumerable: false,
        configurable: true
      });
    }
    function createDynamicOrRuntimeMetadataError(route) {
      return Object.defineProperty(new Error(`Route "${route}": Next.js encountered uncached or runtime data in \`generateMetadata()\`.

This route's metadata is blocked, but the rest of its content can be prerendered.

Ways to fix this:
  - [static] Use a static metadata export instead of \`generateMetadata()\`
  - [cache] Cache the metadata with \`"use cache"\` in \`generateMetadata()\` (does not apply to \`connection()\`)
  - [dynamic] Render a marker component that calls \`await connection()\` inside \`<Suspense>\` on the page

Learn more: https://nextjs.org/docs/messages/blocking-prerender-metadata-runtime`), "__NEXT_ERROR_CODE", {
        value: "E1426",
        enumerable: false,
        configurable: true
      });
    }
    function logBuildDebugHint(route) {
      if (process.env.NODE_ENV !== "development") {
        console.error(`To get a more detailed stack trace and pinpoint the issue, try one of the following:
  - Start the app in development mode by running \`next dev\`, then open "${route}" in your browser to investigate the error.
  - Rerun the production build with \`next build --debug-prerender\` to generate better stack traces.`);
      } else if (!process.env.__NEXT_DEV_SERVER) {
        console.error(`To debug the issue, start the app in development mode by running \`next dev\`, then open "${route}" in your browser to investigate the error.`);
      }
    }
  }
});

// node_modules/next/dist/server/app-render/instant-validation/boundary-constants.js
var require_boundary_constants2 = __commonJS({
  "node_modules/next/dist/server/app-render/instant-validation/boundary-constants.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    _export(exports2, {
      INSTANT_SLOT_MARKER_PREFIX: function() {
        return INSTANT_SLOT_MARKER_PREFIX;
      },
      INSTANT_SLOT_MARKER_SUFFIX: function() {
        return INSTANT_SLOT_MARKER_SUFFIX;
      },
      INSTANT_VALIDATION_BOUNDARY_NAME: function() {
        return INSTANT_VALIDATION_BOUNDARY_NAME;
      }
    });
    var INSTANT_VALIDATION_BOUNDARY_NAME = "__next_instant_validation_boundary__";
    var INSTANT_SLOT_MARKER_PREFIX = "__next_instant_slot_";
    var INSTANT_SLOT_MARKER_SUFFIX = "__";
  }
});

// node_modules/next/dist/server/app-render/instant-validation/boundary-tracking.js
var require_boundary_tracking = __commonJS({
  "node_modules/next/dist/server/app-render/instant-validation/boundary-tracking.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    _export(exports2, {
      allRequiredBoundariesRendered: function() {
        return allRequiredBoundariesRendered;
      },
      createValidationBoundaryTracking: function() {
        return createValidationBoundaryTracking;
      }
    });
    function createValidationBoundaryTracking() {
      return {
        requiredIds: /* @__PURE__ */ new Map(),
        renderedIds: /* @__PURE__ */ new Set()
      };
    }
    function allRequiredBoundariesRendered(state) {
      for (const id of state.requiredIds.keys()) {
        if (!state.renderedIds.has(id)) {
          return false;
        }
      }
      return true;
    }
  }
});

// node_modules/next/dist/shared/lib/instant-messages.js
var require_instant_messages = __commonJS({
  "node_modules/next/dist/shared/lib/instant-messages.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    _export(exports2, {
      createLinkPrefetchPartialError: function() {
        return createLinkPrefetchPartialError;
      },
      createUnrenderedSegmentError: function() {
        return createUnrenderedSegmentError;
      }
    });
    function createUnrenderedSegmentError(route, missingFiles) {
      let message = `Route "${route}": Could not validate that a segment in your UI has instant navigation.`;
      if (missingFiles.length > 0) {
        const label = missingFiles.length === 1 ? "Dropped segment" : "Dropped segments";
        message += `

This segment was dropped from rendering. Issues that would prevent instant navigation will go undetected.

${label}:
${missingFiles.map((p) => `  ${p}`).join("\n")}

Ways to fix this:
  - [render] Render the dropped segment
  - [ignore] Set \`export const instant = false\` to opt the dropped segment out of instant-navigation validation

Learn more: https://nextjs.org/docs/messages/instant-unrendered-segment`;
      }
      return Object.defineProperty(new Error(message), "__NEXT_ERROR_CODE", {
        value: "E1286",
        enumerable: false,
        configurable: true
      });
    }
    function createLinkPrefetchPartialError(pathname) {
      return Object.defineProperty(new Error(`Next.js encountered dynamic data during prefetching for "${pathname}".

This will lead to slower, more expensive prefetches.

Ways to fix this:
  - [upgrade] Opt into Partial Prefetching by exporting \`const prefetch = 'partial'\` from the page or layout, or by setting \`partialPrefetching: true\` in next.config to opt the whole app in
  - [disable] Remove \`prefetch={true}\` from the <Link> to use the default prefetch
  - [ignore] Set \`export const instant = false\` to opt the route out of instant-navigation validation

Learn more: https://nextjs.org/docs/messages/instant-link-prefetch-partial`), "__NEXT_ERROR_CODE", {
        value: "E1435",
        enumerable: false,
        configurable: true
      });
    }
  }
});

// node_modules/next/dist/server/app-render/dynamic-rendering.js
var require_dynamic_rendering = __commonJS({
  "node_modules/next/dist/server/app-render/dynamic-rendering.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    _export(exports2, {
      DynamicHoleKind: function() {
        return DynamicHoleKind;
      },
      Postpone: function() {
        return Postpone;
      },
      PreludeState: function() {
        return PreludeState;
      },
      abortAndThrowOnSynchronousRequestDataAccess: function() {
        return abortAndThrowOnSynchronousRequestDataAccess;
      },
      abortOnSynchronousPlatformIOAccess: function() {
        return abortOnSynchronousPlatformIOAccess;
      },
      accessedDynamicData: function() {
        return accessedDynamicData;
      },
      annotateDynamicAccess: function() {
        return annotateDynamicAccess;
      },
      consumeDynamicAccess: function() {
        return consumeDynamicAccess;
      },
      createDynamicTrackingState: function() {
        return createDynamicTrackingState;
      },
      createDynamicValidationState: function() {
        return createDynamicValidationState;
      },
      createHangingInputAbortSignal: function() {
        return createHangingInputAbortSignal;
      },
      createInstantValidationState: function() {
        return createInstantValidationState;
      },
      createRenderInBrowserAbortSignal: function() {
        return createRenderInBrowserAbortSignal;
      },
      formatDynamicAPIAccesses: function() {
        return formatDynamicAPIAccesses;
      },
      getFirstDynamicReason: function() {
        return getFirstDynamicReason;
      },
      getNavigationDisallowedDynamicReasons: function() {
        return getNavigationDisallowedDynamicReasons;
      },
      getStaticShellDisallowedDynamicReasons: function() {
        return getStaticShellDisallowedDynamicReasons;
      },
      isDynamicPostpone: function() {
        return isDynamicPostpone;
      },
      isPrerenderInterruptedError: function() {
        return isPrerenderInterruptedError;
      },
      logDisallowedDynamicError: function() {
        return logDisallowedDynamicError;
      },
      markCurrentScopeAsDynamic: function() {
        return markCurrentScopeAsDynamic;
      },
      postponeWithTracking: function() {
        return postponeWithTracking;
      },
      throwIfDisallowedDynamic: function() {
        return throwIfDisallowedDynamic;
      },
      throwIfSyncIOUsed: function() {
        return throwIfSyncIOUsed;
      },
      throwToInterruptStaticGeneration: function() {
        return throwToInterruptStaticGeneration;
      },
      trackAllowedDynamicAccess: function() {
        return trackAllowedDynamicAccess;
      },
      trackDynamicDataInDynamicRender: function() {
        return trackDynamicDataInDynamicRender;
      },
      trackDynamicHoleInNavigation: function() {
        return trackDynamicHoleInNavigation;
      },
      trackDynamicHoleInRuntimeShell: function() {
        return trackDynamicHoleInRuntimeShell;
      },
      trackDynamicHoleInStaticShell: function() {
        return trackDynamicHoleInStaticShell;
      },
      trackThrownErrorInNavigation: function() {
        return trackThrownErrorInNavigation;
      },
      useDynamicRouteParams: function() {
        return useDynamicRouteParams;
      },
      useDynamicSearchParams: function() {
        return useDynamicSearchParams;
      }
    });
    var _react = /* @__PURE__ */ _interop_require_default(require_react());
    var _hooksservercontext = require_hooks_server_context();
    var _staticgenerationbailout = require_static_generation_bailout();
    var _workunitasyncstorageexternal = require_work_unit_async_storage_external();
    var _workasyncstorageexternal = require_work_async_storage_external();
    var _dynamicrenderingutils = require_dynamic_rendering_utils();
    var _boundaryconstants = require_boundary_constants();
    var _scheduler = require_scheduler();
    var _bailouttocsr = require_bailout_to_csr();
    var _blockingroutemessages = require_blocking_route_messages();
    var _invarianterror = require_invariant_error();
    var _boundaryconstants1 = require_boundary_constants2();
    var _boundarytracking = require_boundary_tracking();
    var _instantmessages = require_instant_messages();
    function _interop_require_default(obj) {
      return obj && obj.__esModule ? obj : {
        default: obj
      };
    }
    var hasPostpone = typeof _react.default.unstable_postpone === "function";
    function createDynamicTrackingState(isDebugDynamicAccesses) {
      return {
        isDebugDynamicAccesses,
        dynamicAccesses: [],
        syncDynamicErrorWithStack: null,
        syncDynamicErrorWithStackPostMicrotask: false
      };
    }
    function createDynamicValidationState() {
      return {
        hasSuspenseAboveBody: false,
        hasDynamicMetadata: false,
        dynamicMetadata: null,
        hasDynamicViewport: false,
        hasAllowedDynamic: false,
        dynamicErrors: []
      };
    }
    function getPendingClientSyncDynamicError(clientDynamic) {
      return clientDynamic.syncDynamicErrorWithStackPostMicrotask ? null : clientDynamic.syncDynamicErrorWithStack;
    }
    function getFirstDynamicReason(trackingState) {
      var _trackingState_dynamicAccesses_;
      return (_trackingState_dynamicAccesses_ = trackingState.dynamicAccesses[0]) == null ? void 0 : _trackingState_dynamicAccesses_.expression;
    }
    function markCurrentScopeAsDynamic(store, workUnitStore, expression) {
      if (workUnitStore) {
        switch (workUnitStore.type) {
          case "cache":
          case "unstable-cache":
            return;
          case "private-cache":
            return;
          case "prerender-legacy":
          case "prerender-ppr":
          case "request":
          case "generate-static-params":
            break;
          default:
            workUnitStore;
        }
      }
      if (store.forceDynamic || store.forceStatic) return;
      if (store.dynamicShouldError) {
        throw Object.defineProperty(new _staticgenerationbailout.StaticGenBailoutError(`Route ${store.route} with \`dynamic = "error"\` couldn't be rendered statically because it used \`${expression}\`. See more info here: https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic#dynamic-rendering`), "__NEXT_ERROR_CODE", {
          value: "E553",
          enumerable: false,
          configurable: true
        });
      }
      if (workUnitStore) {
        switch (workUnitStore.type) {
          case "prerender-ppr":
            return postponeWithTracking(store.route, expression, workUnitStore.dynamicTracking);
          case "prerender-legacy":
            workUnitStore.revalidate = 0;
            const err = Object.defineProperty(new _hooksservercontext.DynamicServerError(`Route ${store.route} couldn't be rendered statically because it used ${expression}. See more info here: https://nextjs.org/docs/messages/dynamic-server-error`), "__NEXT_ERROR_CODE", {
              value: "E550",
              enumerable: false,
              configurable: true
            });
            store.dynamicUsageDescription = expression;
            store.dynamicUsageStack = err.stack;
            throw err;
          case "request":
            if (process.env.NODE_ENV !== "production") {
              workUnitStore.usedDynamic = true;
            }
            break;
          case "generate-static-params":
            break;
          default:
            workUnitStore;
        }
      }
    }
    function throwToInterruptStaticGeneration(expression, store, prerenderStore) {
      const err = Object.defineProperty(new _hooksservercontext.DynamicServerError(`Route ${store.route} couldn't be rendered statically because it used \`${expression}\`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error`), "__NEXT_ERROR_CODE", {
        value: "E558",
        enumerable: false,
        configurable: true
      });
      prerenderStore.revalidate = 0;
      store.dynamicUsageDescription = expression;
      store.dynamicUsageStack = err.stack;
      throw err;
    }
    function trackDynamicDataInDynamicRender(workUnitStore) {
      switch (workUnitStore.type) {
        case "cache":
        case "unstable-cache":
          return;
        case "private-cache":
          return;
        case "prerender":
        case "prerender-runtime":
        case "prerender-legacy":
        case "prerender-ppr":
        case "prerender-client":
        case "validation-client":
        case "generate-static-params":
          break;
        case "request":
          if (process.env.NODE_ENV !== "production") {
            workUnitStore.usedDynamic = true;
          }
          break;
        default:
          workUnitStore;
      }
    }
    function abortOnSynchronousDynamicDataAccess(route, expression, prerenderStore) {
      const reason = `Route ${route} needs to bail out of prerendering at this point because it used ${expression}.`;
      const error = createPrerenderInterruptedError(reason);
      prerenderStore.controller.abort(error);
      const dynamicTracking = prerenderStore.dynamicTracking;
      if (dynamicTracking) {
        dynamicTracking.dynamicAccesses.push({
          // When we aren't debugging, we don't need to create another error for the
          // stack trace.
          stack: dynamicTracking.isDebugDynamicAccesses ? new Error().stack : void 0,
          expression
        });
      }
    }
    function abortOnSynchronousPlatformIOAccess(route, expression, errorWithStack, prerenderStore) {
      const dynamicTracking = prerenderStore.dynamicTracking;
      if (dynamicTracking && dynamicTracking.syncDynamicErrorWithStack === null) {
        dynamicTracking.syncDynamicErrorWithStack = errorWithStack;
        queueMicrotask(() => {
          dynamicTracking.syncDynamicErrorWithStackPostMicrotask = true;
        });
      }
      abortOnSynchronousDynamicDataAccess(route, expression, prerenderStore);
    }
    function abortAndThrowOnSynchronousRequestDataAccess(route, expression, errorWithStack, prerenderStore) {
      (0, _dynamicrenderingutils.trackRuntimeDataAccessed)(prerenderStore);
      const prerenderSignal = prerenderStore.controller.signal;
      if (prerenderSignal.aborted === false) {
        abortOnSynchronousDynamicDataAccess(route, expression, prerenderStore);
        const dynamicTracking = prerenderStore.dynamicTracking;
        if (dynamicTracking) {
          if (dynamicTracking.syncDynamicErrorWithStack === null) {
            dynamicTracking.syncDynamicErrorWithStack = errorWithStack;
          }
        }
      }
      throw createPrerenderInterruptedError(`Route ${route} needs to bail out of prerendering at this point because it used ${expression}.`);
    }
    function Postpone({ reason, route }) {
      const prerenderStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
      const dynamicTracking = prerenderStore && prerenderStore.type === "prerender-ppr" ? prerenderStore.dynamicTracking : null;
      postponeWithTracking(route, reason, dynamicTracking);
    }
    function postponeWithTracking(route, expression, dynamicTracking) {
      assertPostpone();
      if (dynamicTracking) {
        dynamicTracking.dynamicAccesses.push({
          // When we aren't debugging, we don't need to create another error for the
          // stack trace.
          stack: dynamicTracking.isDebugDynamicAccesses ? new Error().stack : void 0,
          expression
        });
      }
      _react.default.unstable_postpone(createPostponeReason(route, expression));
    }
    function createPostponeReason(route, expression) {
      return `Route ${route} needs to bail out of prerendering at this point because it used ${expression}. React throws this special object to indicate where. It should not be caught by your own try/catch. Learn more: https://nextjs.org/docs/messages/ppr-caught-error`;
    }
    function isDynamicPostpone(err) {
      if (typeof err === "object" && err !== null && typeof err.message === "string") {
        return isDynamicPostponeReason(err.message);
      }
      return false;
    }
    function isDynamicPostponeReason(reason) {
      return reason.includes("needs to bail out of prerendering at this point because it used") && reason.includes("Learn more: https://nextjs.org/docs/messages/ppr-caught-error");
    }
    if (isDynamicPostponeReason(createPostponeReason("%%%", "^^^")) === false) {
      throw Object.defineProperty(new Error("Invariant: isDynamicPostpone misidentified a postpone reason. This is a bug in Next.js"), "__NEXT_ERROR_CODE", {
        value: "E296",
        enumerable: false,
        configurable: true
      });
    }
    var NEXT_PRERENDER_INTERRUPTED = "NEXT_PRERENDER_INTERRUPTED";
    function createPrerenderInterruptedError(message) {
      const error = Object.defineProperty(new Error(message), "__NEXT_ERROR_CODE", {
        value: "E394",
        enumerable: false,
        configurable: true
      });
      error.digest = NEXT_PRERENDER_INTERRUPTED;
      return error;
    }
    function isPrerenderInterruptedError(error) {
      return typeof error === "object" && error !== null && error.digest === NEXT_PRERENDER_INTERRUPTED && "name" in error && "message" in error && error instanceof Error;
    }
    function accessedDynamicData(dynamicAccesses) {
      return dynamicAccesses.length > 0;
    }
    function consumeDynamicAccess(serverDynamic, clientDynamic) {
      serverDynamic.dynamicAccesses.push(...clientDynamic.dynamicAccesses);
      return serverDynamic.dynamicAccesses;
    }
    function formatDynamicAPIAccesses(dynamicAccesses) {
      return dynamicAccesses.filter((access) => typeof access.stack === "string" && access.stack.length > 0).map(({ expression, stack }) => {
        stack = stack.split("\n").slice(4).filter((line2) => {
          if (line2.includes("node_modules/next/")) {
            return false;
          }
          if (line2.includes(" (<anonymous>)")) {
            return false;
          }
          if (line2.includes(" (node:")) {
            return false;
          }
          return true;
        }).join("\n");
        return `Dynamic API Usage Debug - ${expression}:
${stack}`;
      });
    }
    function assertPostpone() {
      if (!hasPostpone) {
        throw Object.defineProperty(new Error(`Invariant: React.unstable_postpone is not defined. This suggests the wrong version of React was loaded. This is a bug in Next.js`), "__NEXT_ERROR_CODE", {
          value: "E224",
          enumerable: false,
          configurable: true
        });
      }
    }
    function createRenderInBrowserAbortSignal() {
      const controller = new AbortController();
      controller.abort(Object.defineProperty(new _bailouttocsr.BailoutToCSRError("Render in Browser"), "__NEXT_ERROR_CODE", {
        value: "E721",
        enumerable: false,
        configurable: true
      }));
      return controller.signal;
    }
    function createHangingInputAbortSignal(workUnitStore) {
      switch (workUnitStore.type) {
        case "prerender":
        case "prerender-runtime":
          const controller = new AbortController();
          if (workUnitStore.cacheSignal) {
            workUnitStore.cacheSignal.inputReady().then(() => {
              controller.abort();
            });
          } else {
            const stagedRendering = (0, _workunitasyncstorageexternal.getStagedRenderingController)(workUnitStore);
            if (stagedRendering && stagedRendering.finalStage !== null) {
              stagedRendering.waitForStage(stagedRendering.finalStage).then(() => (0, _scheduler.scheduleOnNextTick)(() => controller.abort()), noop);
            } else {
              (0, _scheduler.scheduleOnNextTick)(() => controller.abort());
            }
          }
          return controller.signal;
        case "prerender-client":
        case "validation-client":
        case "prerender-ppr":
        case "prerender-legacy":
        case "request":
        case "cache":
        case "private-cache":
        case "unstable-cache":
        case "generate-static-params":
          return void 0;
        default:
          workUnitStore;
      }
    }
    function noop() {
    }
    function annotateDynamicAccess(expression, prerenderStore) {
      const dynamicTracking = prerenderStore.dynamicTracking;
      if (dynamicTracking) {
        dynamicTracking.dynamicAccesses.push({
          stack: dynamicTracking.isDebugDynamicAccesses ? new Error().stack : void 0,
          expression
        });
      }
    }
    function useDynamicRouteParams(expression) {
      const workStore = _workasyncstorageexternal.workAsyncStorage.getStore();
      const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
      if (workStore && workUnitStore) {
        switch (workUnitStore.type) {
          case "prerender-client": {
            const fallbackParams = workUnitStore.fallbackRouteParams;
            if (fallbackParams && fallbackParams.size > 0) {
              _react.default.use((0, _dynamicrenderingutils.makeClientHookHangingPromise)(workUnitStore.renderSignal, new _dynamicrenderingutils.ClientHookDynamicError(workStore.route, expression)));
            }
            break;
          }
          case "prerender":
            throw Object.defineProperty(new _invarianterror.InvariantError(`\`${expression}\` was called from a Server Component. Next.js should be preventing ${expression} from being included in server components statically, but did not in this case.`), "__NEXT_ERROR_CODE", {
              value: "E795",
              enumerable: false,
              configurable: true
            });
          case "prerender-ppr": {
            const fallbackParams = workUnitStore.fallbackRouteParams;
            if (fallbackParams && fallbackParams.size > 0) {
              return postponeWithTracking(workStore.route, expression, workUnitStore.dynamicTracking);
            }
            break;
          }
          case "validation-client": {
            break;
          }
          case "prerender-runtime":
            throw Object.defineProperty(new _invarianterror.InvariantError(`\`${expression}\` was called during a runtime prerender. Next.js should be preventing ${expression} from being included in server components statically, but did not in this case.`), "__NEXT_ERROR_CODE", {
              value: "E771",
              enumerable: false,
              configurable: true
            });
          case "cache":
          case "private-cache":
            throw Object.defineProperty(new _invarianterror.InvariantError(`\`${expression}\` was called inside a cache scope. Next.js should be preventing ${expression} from being included in server components statically, but did not in this case.`), "__NEXT_ERROR_CODE", {
              value: "E745",
              enumerable: false,
              configurable: true
            });
          case "generate-static-params":
            throw Object.defineProperty(new _invarianterror.InvariantError(`\`${expression}\` was called in \`generateStaticParams\`. Next.js should be preventing ${expression} from being included in server component files statically, but did not in this case.`), "__NEXT_ERROR_CODE", {
              value: "E1130",
              enumerable: false,
              configurable: true
            });
          case "prerender-legacy":
          case "request":
          case "unstable-cache":
            break;
          default:
            workUnitStore;
        }
      }
    }
    function useDynamicSearchParams(expression) {
      const workStore = _workasyncstorageexternal.workAsyncStorage.getStore();
      const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
      if (!workStore) {
        return;
      }
      if (!workUnitStore) {
        (0, _workunitasyncstorageexternal.throwForMissingRequestStore)(expression);
      }
      switch (workUnitStore.type) {
        case "validation-client":
          return;
        case "prerender-client": {
          _react.default.use((0, _dynamicrenderingutils.makeClientHookHangingPromise)(workUnitStore.renderSignal, new _dynamicrenderingutils.ClientHookDynamicError(workStore.route, expression)));
          break;
        }
        case "prerender-legacy":
        case "prerender-ppr": {
          if (workStore.forceStatic) {
            return;
          }
          throw Object.defineProperty(new _bailouttocsr.BailoutToCSRError(expression), "__NEXT_ERROR_CODE", {
            value: "E394",
            enumerable: false,
            configurable: true
          });
        }
        case "prerender":
        case "prerender-runtime":
          throw Object.defineProperty(new _invarianterror.InvariantError(`\`${expression}\` was called from a Server Component. Next.js should be preventing ${expression} from being included in server components statically, but did not in this case.`), "__NEXT_ERROR_CODE", {
            value: "E795",
            enumerable: false,
            configurable: true
          });
        case "cache":
        case "unstable-cache":
        case "private-cache":
          throw Object.defineProperty(new _invarianterror.InvariantError(`\`${expression}\` was called inside a cache scope. Next.js should be preventing ${expression} from being included in server components statically, but did not in this case.`), "__NEXT_ERROR_CODE", {
            value: "E745",
            enumerable: false,
            configurable: true
          });
        case "generate-static-params":
          throw Object.defineProperty(new _invarianterror.InvariantError(`\`${expression}\` was called in \`generateStaticParams\`. Next.js should be preventing ${expression} from being included in server component files statically, but did not in this case.`), "__NEXT_ERROR_CODE", {
            value: "E1130",
            enumerable: false,
            configurable: true
          });
        case "request":
          return;
        default:
          workUnitStore;
      }
    }
    var hasSuspenseRegex = /\n\s+at Suspense \(<anonymous>\)/;
    var bodyAndImplicitTags = "body|div|main|section|article|aside|header|footer|nav|form|p|span|h1|h2|h3|h4|h5|h6";
    var hasSuspenseBeforeRootLayoutWithoutBodyOrImplicitBodyRegex = new RegExp(`\\n\\s+at Suspense \\(<anonymous>\\)(?:(?!\\n\\s+at (?:${bodyAndImplicitTags}) \\(<anonymous>\\))[\\s\\S])*?\\n\\s+at ${_boundaryconstants.ROOT_LAYOUT_BOUNDARY_NAME} \\([^\\n]*\\)`);
    var hasMetadataRegex = new RegExp(`\\n\\s+at ${_boundaryconstants.METADATA_BOUNDARY_NAME}[\\n\\s]`);
    var hasViewportRegex = new RegExp(`\\n\\s+at ${_boundaryconstants.VIEWPORT_BOUNDARY_NAME}[\\n\\s]`);
    var hasOutletRegex = new RegExp(`\\n\\s+at ${_boundaryconstants.OUTLET_BOUNDARY_NAME}[\\n\\s]`);
    var hasInstantValidationBoundaryRegex = new RegExp(`\\n\\s+at ${_boundaryconstants1.INSTANT_VALIDATION_BOUNDARY_NAME}[\\n\\s]`);
    var slotMarkerRegex = new RegExp(`\\n\\s+at ${_boundaryconstants1.INSTANT_SLOT_MARKER_PREFIX}(\\d+)${_boundaryconstants1.INSTANT_SLOT_MARKER_SUFFIX}[\\n\\s]`);
    function resolveInstantStack(componentStack, dynamicValidation) {
      const { slotStacks } = dynamicValidation;
      if (slotStacks.length > 1) {
        const match = slotMarkerRegex.exec(componentStack);
        if (match) {
          const slotIndex = parseInt(match[1], 10) + 1;
          const slotStack = slotStacks[slotIndex];
          if (slotStack != null) {
            return slotStack;
          }
        }
      }
      return slotStacks[0] ?? null;
    }
    function trackOutletSuspenseAboveBody(componentStack, dynamicValidation) {
      if (hasSuspenseBeforeRootLayoutWithoutBodyOrImplicitBodyRegex.test(componentStack)) {
        dynamicValidation.hasSuspenseAboveBody = true;
      }
    }
    function trackAllowedDynamicAccess(dynamicReason, workStore, componentStack, dynamicValidation, clientDynamic) {
      const syncDynamicError = getPendingClientSyncDynamicError(clientDynamic);
      if (hasOutletRegex.test(componentStack)) {
        trackOutletSuspenseAboveBody(componentStack, dynamicValidation);
        return;
      } else if (hasMetadataRegex.test(componentStack)) {
        dynamicValidation.hasDynamicMetadata = true;
        return;
      } else if (hasViewportRegex.test(componentStack)) {
        dynamicValidation.hasDynamicViewport = true;
        return;
      } else if (hasSuspenseBeforeRootLayoutWithoutBodyOrImplicitBodyRegex.test(componentStack)) {
        dynamicValidation.hasAllowedDynamic = true;
        dynamicValidation.hasSuspenseAboveBody = true;
        return;
      } else if (hasSuspenseRegex.test(componentStack)) {
        dynamicValidation.hasAllowedDynamic = true;
        return;
      } else if (syncDynamicError) {
        dynamicValidation.dynamicErrors.push(syncDynamicError);
        return;
      }
      if ((0, _dynamicrenderingutils.isClientHookDynamicError)(dynamicReason)) {
        dynamicValidation.dynamicErrors.push(addErrorContext(dynamicReason, componentStack, null));
        return;
      }
      const error = addErrorContext((0, _blockingroutemessages.createDynamicOrRuntimeBodyError)(workStore.route), componentStack, null);
      dynamicValidation.dynamicErrors.push(error);
      return;
    }
    var DynamicHoleKind = /* @__PURE__ */ function(DynamicHoleKind2) {
      DynamicHoleKind2[DynamicHoleKind2["Link"] = 1] = "Link";
      DynamicHoleKind2[DynamicHoleKind2["Runtime"] = 2] = "Runtime";
      DynamicHoleKind2[DynamicHoleKind2["Dynamic"] = 3] = "Dynamic";
      return DynamicHoleKind2;
    }({});
    function createInstantValidationState(slotStacks) {
      return {
        hasDynamicMetadata: false,
        hasAllowedClientDynamicAboveBoundary: false,
        dynamicMetadata: null,
        hasDynamicViewport: false,
        hasAllowedDynamic: false,
        dynamicErrors: [],
        validationPreventingErrors: [],
        thrownErrorsOutsideBoundary: [],
        slotStacks
      };
    }
    function trackDynamicHoleInNavigation(dynamicReason, workStore, componentStack, dynamicValidation, clientDynamic, kind, boundaryState) {
      const syncDynamicError = getPendingClientSyncDynamicError(clientDynamic);
      if (hasOutletRegex.test(componentStack)) {
        return;
      }
      const effectiveCreateInstantStack = resolveInstantStack(componentStack, dynamicValidation);
      if (hasMetadataRegex.test(componentStack)) {
        const error2 = addErrorContext(kind === 1 ? (0, _blockingroutemessages.createLinkMetadataError)(workStore.route) : kind === 2 ? (0, _blockingroutemessages.createRuntimeMetadataError)(workStore.route) : (0, _blockingroutemessages.createDynamicMetadataError)(workStore.route), componentStack, effectiveCreateInstantStack);
        dynamicValidation.dynamicMetadata = error2;
        return;
      }
      if (hasViewportRegex.test(componentStack)) {
        const error2 = addErrorContext(kind === 1 ? (0, _blockingroutemessages.createLinkViewportError)(workStore.route) : kind === 2 ? (0, _blockingroutemessages.createRuntimeViewportError)(workStore.route) : (0, _blockingroutemessages.createDynamicViewportError)(workStore.route), componentStack, effectiveCreateInstantStack);
        dynamicValidation.dynamicErrors.push(error2);
        return;
      }
      const boundaryLocation = hasInstantValidationBoundaryRegex.exec(componentStack);
      if (!boundaryLocation) {
        if ((0, _boundarytracking.allRequiredBoundariesRendered)(boundaryState)) {
          dynamicValidation.hasAllowedClientDynamicAboveBoundary = true;
          dynamicValidation.hasAllowedDynamic = true;
          return;
        } else {
          const message = `Route "${workStore.route}": Could not validate \`instant\` because a Client Component in a parent segment prevented the page from rendering.`;
          const error2 = addErrorContext(Object.defineProperty(new Error(message), "__NEXT_ERROR_CODE", {
            value: "E1331",
            enumerable: false,
            configurable: true
          }), componentStack, effectiveCreateInstantStack);
          dynamicValidation.validationPreventingErrors.push(error2);
          return;
        }
      } else {
        const suspenseLocation = hasSuspenseRegex.exec(componentStack);
        if (suspenseLocation) {
          if (suspenseLocation.index < boundaryLocation.index) {
            dynamicValidation.hasAllowedDynamic = true;
            return;
          } else {
          }
        }
      }
      if (syncDynamicError) {
        if (effectiveCreateInstantStack !== null && syncDynamicError.cause === void 0) {
          syncDynamicError.cause = effectiveCreateInstantStack();
        }
        dynamicValidation.dynamicErrors.push(syncDynamicError);
        return;
      }
      if ((0, _dynamicrenderingutils.isClientHookDynamicError)(dynamicReason)) {
        dynamicValidation.dynamicErrors.push(addErrorContext(dynamicReason, componentStack, effectiveCreateInstantStack));
        return;
      }
      const error = addErrorContext(kind === 1 ? (0, _blockingroutemessages.createLinkBodyErrorInNavigation)(workStore.route) : kind === 2 ? (0, _blockingroutemessages.createRuntimeBodyErrorInNavigation)(workStore.route) : (0, _blockingroutemessages.createDynamicBodyErrorInNavigation)(workStore.route), componentStack, effectiveCreateInstantStack);
      dynamicValidation.dynamicErrors.push(error);
      return;
    }
    function trackThrownErrorInNavigation(workStore, dynamicValidation, thrownValue, componentStack) {
      const boundaryLocation = hasInstantValidationBoundaryRegex.exec(componentStack);
      if (!boundaryLocation) {
        const error = addErrorContext(Object.defineProperty(new Error("An error occurred while attempting to validate instant UI. This error may be preventing the validation from completing.", {
          cause: thrownValue
        }), "__NEXT_ERROR_CODE", {
          value: "E1118",
          enumerable: false,
          configurable: true
        }), componentStack, null);
        dynamicValidation.thrownErrorsOutsideBoundary.push(error);
      } else {
        const suspenseLocation = hasSuspenseRegex.exec(componentStack);
        if (suspenseLocation) {
          if (suspenseLocation.index < boundaryLocation.index) {
            return;
          } else {
          }
        }
        const message = `Route "${workStore.route}": Could not validate \`instant\` because an error prevented the target segment from rendering.`;
        const error = addErrorContext(
          Object.defineProperty(new Error(message, {
            cause: thrownValue
          }), "__NEXT_ERROR_CODE", {
            value: "E1338",
            enumerable: false,
            configurable: true
          }),
          componentStack,
          null
          // TODO(instant-validation-build): conflicting use of cause
        );
        dynamicValidation.validationPreventingErrors.push(error);
      }
    }
    function trackDynamicHoleInRuntimeShell(dynamicReason, workStore, componentStack, dynamicValidation, clientDynamic) {
      const syncDynamicError = getPendingClientSyncDynamicError(clientDynamic);
      if (hasOutletRegex.test(componentStack)) {
        trackOutletSuspenseAboveBody(componentStack, dynamicValidation);
        return;
      } else if (hasMetadataRegex.test(componentStack)) {
        const error2 = addErrorContext((0, _blockingroutemessages.createDynamicMetadataError)(workStore.route), componentStack, null);
        dynamicValidation.dynamicMetadata = error2;
        return;
      } else if (hasViewportRegex.test(componentStack)) {
        const error2 = addErrorContext((0, _blockingroutemessages.createDynamicViewportError)(workStore.route), componentStack, null);
        dynamicValidation.dynamicErrors.push(error2);
        return;
      } else if (hasSuspenseBeforeRootLayoutWithoutBodyOrImplicitBodyRegex.test(componentStack)) {
        dynamicValidation.hasAllowedDynamic = true;
        dynamicValidation.hasSuspenseAboveBody = true;
        return;
      } else if (hasSuspenseRegex.test(componentStack)) {
        dynamicValidation.hasAllowedDynamic = true;
        return;
      } else if (syncDynamicError) {
        dynamicValidation.dynamicErrors.push(syncDynamicError);
        return;
      }
      if ((0, _dynamicrenderingutils.isClientHookDynamicError)(dynamicReason)) {
        dynamicValidation.dynamicErrors.push(addErrorContext(dynamicReason, componentStack, null));
        return;
      }
      const error = addErrorContext((0, _blockingroutemessages.createDynamicBodyError)(workStore.route), componentStack, null);
      dynamicValidation.dynamicErrors.push(error);
      return;
    }
    function trackDynamicHoleInStaticShell(dynamicReason, workStore, componentStack, dynamicValidation, clientDynamic) {
      const syncDynamicError = getPendingClientSyncDynamicError(clientDynamic);
      if (hasOutletRegex.test(componentStack)) {
        trackOutletSuspenseAboveBody(componentStack, dynamicValidation);
        return;
      } else if (hasMetadataRegex.test(componentStack)) {
        const error2 = addErrorContext((0, _blockingroutemessages.createRuntimeMetadataError)(workStore.route), componentStack, null);
        dynamicValidation.dynamicMetadata = error2;
        return;
      } else if (hasViewportRegex.test(componentStack)) {
        const error2 = addErrorContext((0, _blockingroutemessages.createRuntimeViewportError)(workStore.route), componentStack, null);
        dynamicValidation.dynamicErrors.push(error2);
        return;
      } else if (hasSuspenseBeforeRootLayoutWithoutBodyOrImplicitBodyRegex.test(componentStack)) {
        dynamicValidation.hasAllowedDynamic = true;
        dynamicValidation.hasSuspenseAboveBody = true;
        return;
      } else if (hasSuspenseRegex.test(componentStack)) {
        dynamicValidation.hasAllowedDynamic = true;
        return;
      } else if (syncDynamicError) {
        dynamicValidation.dynamicErrors.push(syncDynamicError);
        return;
      }
      if ((0, _dynamicrenderingutils.isClientHookDynamicError)(dynamicReason)) {
        dynamicValidation.dynamicErrors.push(addErrorContext(dynamicReason, componentStack, null));
        return;
      }
      const error = addErrorContext((0, _blockingroutemessages.createRuntimeBodyError)(workStore.route), componentStack, null);
      dynamicValidation.dynamicErrors.push(error);
      return;
    }
    function addErrorContext(error, componentStack, createInstantStack) {
      const ownerStack = process.env.NODE_ENV !== "production" && _react.default.captureOwnerStack ? _react.default.captureOwnerStack() : null;
      if (createInstantStack !== null) {
        error.cause = createInstantStack();
      }
      error.stack = error.name + ": " + error.message + (ownerStack || componentStack);
      return error;
    }
    var PreludeState = /* @__PURE__ */ function(PreludeState2) {
      PreludeState2[PreludeState2["Full"] = 0] = "Full";
      PreludeState2[PreludeState2["Empty"] = 1] = "Empty";
      PreludeState2[PreludeState2["Errored"] = 2] = "Errored";
      return PreludeState2;
    }({});
    function logDisallowedDynamicError(workStore, error) {
      console.error(error);
      (0, _blockingroutemessages.logBuildDebugHint)(workStore.route);
    }
    function throwIfSyncIOUsed(workStore, serverDynamic) {
      if (serverDynamic.syncDynamicErrorWithStack) {
        logDisallowedDynamicError(workStore, serverDynamic.syncDynamicErrorWithStack);
        throw new _staticgenerationbailout.StaticGenBailoutError();
      }
    }
    function throwIfDisallowedDynamic(workStore, prelude, dynamicValidation, serverDynamic, allowEmptyStaticShell) {
      throwIfSyncIOUsed(workStore, serverDynamic);
      if (prelude === 0 && dynamicValidation.hasAllowedDynamic === false && dynamicValidation.hasDynamicMetadata) {
        console.error((0, _blockingroutemessages.createDynamicOrRuntimeMetadataError)(workStore.route).message);
        throw new _staticgenerationbailout.StaticGenBailoutError();
      }
      if (allowEmptyStaticShell || dynamicValidation.hasSuspenseAboveBody) {
        return;
      }
      if (prelude !== 0) {
        const dynamicErrors = dynamicValidation.dynamicErrors;
        if (dynamicErrors.length > 0) {
          for (let i = 0; i < dynamicErrors.length; i++) {
            logDisallowedDynamicError(workStore, dynamicErrors[i]);
          }
          throw new _staticgenerationbailout.StaticGenBailoutError();
        }
        if (dynamicValidation.hasDynamicViewport) {
          console.error((0, _blockingroutemessages.createDynamicOrRuntimeViewportError)(workStore.route).message);
          throw new _staticgenerationbailout.StaticGenBailoutError();
        }
        if (prelude === 1) {
          console.error(`Route "${workStore.route}" did not produce a static shell and Next.js was unable to determine a reason. This is a bug in Next.js.`);
          throw new _staticgenerationbailout.StaticGenBailoutError();
        }
      }
    }
    function getStaticShellDisallowedDynamicReasons(workStore, prelude, dynamicValidation, allowEmptyStaticShell) {
      if (prelude === 0 && dynamicValidation.hasAllowedDynamic === false && dynamicValidation.dynamicErrors.length === 0 && dynamicValidation.dynamicMetadata) {
        return [
          dynamicValidation.dynamicMetadata
        ];
      }
      if (allowEmptyStaticShell || dynamicValidation.hasSuspenseAboveBody) {
        return [];
      }
      if (prelude !== 0) {
        const dynamicErrors = dynamicValidation.dynamicErrors;
        if (dynamicErrors.length > 0) {
          return dynamicErrors;
        }
        if (prelude === 1) {
          return [
            Object.defineProperty(new _invarianterror.InvariantError(`Route "${workStore.route}" did not produce a static shell and Next.js was unable to determine a reason.`), "__NEXT_ERROR_CODE", {
              value: "E936",
              enumerable: false,
              configurable: true
            })
          ];
        }
      }
      return [];
    }
    function getNavigationDisallowedDynamicReasons(workStore, prelude, dynamicValidation, validationSampleTracking, boundaryState, devRenderDidError) {
      if (validationSampleTracking) {
        const { missingSampleErrors } = validationSampleTracking;
        if (missingSampleErrors.length > 0) {
          return missingSampleErrors;
        }
      }
      const { validationPreventingErrors } = dynamicValidation;
      if (validationPreventingErrors.length > 0) {
        if (process.env.__NEXT_DEV_SERVER && devRenderDidError) {
          return [];
        }
        return validationPreventingErrors;
      }
      if (prelude !== 0) {
        const dynamicErrors = dynamicValidation.dynamicErrors;
        if (dynamicErrors.length > 0) {
          return dynamicErrors;
        }
        if (prelude === 1 && !dynamicValidation.hasAllowedClientDynamicAboveBoundary && (0, _boundarytracking.allRequiredBoundariesRendered)(boundaryState)) {
          return Object.defineProperty(new _invarianterror.InvariantError(`Route "${workStore.route}" failed to render during instant validation and Next.js was unable to determine a reason.`), "__NEXT_ERROR_CODE", {
            value: "E1055",
            enumerable: false,
            configurable: true
          });
        }
      } else {
        const dynamicErrors = dynamicValidation.dynamicErrors;
        if (dynamicErrors.length > 0) {
          return dynamicErrors;
        }
        if (dynamicValidation.hasAllowedDynamic === false && dynamicValidation.dynamicMetadata) {
          return [
            dynamicValidation.dynamicMetadata
          ];
        }
      }
      if (!(0, _boundarytracking.allRequiredBoundariesRendered)(boundaryState)) {
        const { thrownErrorsOutsideBoundary } = dynamicValidation;
        const rootInstantStack = dynamicValidation.slotStacks[0];
        if (thrownErrorsOutsideBoundary.length === 0) {
          const missingFiles = [];
          for (const [id, filePaths] of boundaryState.requiredIds) {
            if (!boundaryState.renderedIds.has(id)) {
              for (const filePath of filePaths) {
                let normalized = filePath.replace(/^\[project\][\\/]?/, "").replace(process.cwd() + "/", "").replace(process.cwd() + "\\", "");
                missingFiles.push(normalized);
              }
            }
          }
          missingFiles.sort();
          return (0, _instantmessages.createUnrenderedSegmentError)(workStore.route, missingFiles);
        } else if (process.env.__NEXT_DEV_SERVER && devRenderDidError) {
          return [];
        } else if (thrownErrorsOutsideBoundary.length === 1) {
          const message = `Route "${workStore.route}": Could not validate \`instant\` because the target segment was prevented from rendering, likely due to the following error.`;
          const error = rootInstantStack !== null ? rootInstantStack() : new Error();
          error.name = "Error";
          error.message = message;
          return new AggregateError([
            error,
            thrownErrorsOutsideBoundary[0]
          ]);
        } else {
          const message = `Route "${workStore.route}": Could not validate \`instant\` because the target segment was prevented from rendering, likely due to one of the following errors.`;
          const error = rootInstantStack !== null ? rootInstantStack() : new Error();
          error.name = "Error";
          error.message = message;
          return new AggregateError([
            error,
            ...thrownErrorsOutsideBoundary
          ]);
        }
      }
      return [];
    }
  }
});

// node_modules/next/dist/server/create-deduped-by-callsite-server-error-logger.js
var require_create_deduped_by_callsite_server_error_logger = __commonJS({
  "node_modules/next/dist/server/create-deduped-by-callsite-server-error-logger.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    Object.defineProperty(exports2, "createDedupedByCallsiteServerErrorLoggerDev", {
      enumerable: true,
      get: function() {
        return createDedupedByCallsiteServerErrorLoggerDev;
      }
    });
    var _react = /* @__PURE__ */ _interop_require_wildcard(require_react());
    function _getRequireWildcardCache(nodeInterop) {
      if (typeof WeakMap !== "function") return null;
      var cacheBabelInterop = /* @__PURE__ */ new WeakMap();
      var cacheNodeInterop = /* @__PURE__ */ new WeakMap();
      return (_getRequireWildcardCache = function(nodeInterop2) {
        return nodeInterop2 ? cacheNodeInterop : cacheBabelInterop;
      })(nodeInterop);
    }
    function _interop_require_wildcard(obj, nodeInterop) {
      if (!nodeInterop && obj && obj.__esModule) {
        return obj;
      }
      if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
          default: obj
        };
      }
      var cache2 = _getRequireWildcardCache(nodeInterop);
      if (cache2 && cache2.has(obj)) {
        return cache2.get(obj);
      }
      var newObj = {
        __proto__: null
      };
      var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
      for (var key in obj) {
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
          var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
          if (desc && (desc.get || desc.set)) {
            Object.defineProperty(newObj, key, desc);
          } else {
            newObj[key] = obj[key];
          }
        }
      }
      newObj.default = obj;
      if (cache2) {
        cache2.set(obj, newObj);
      }
      return newObj;
    }
    var errorRef = {
      current: null
    };
    var cache = typeof _react.cache === "function" ? _react.cache : (fn) => fn;
    var logErrorOrWarn = process.env.__NEXT_CACHE_COMPONENTS ? console.error : console.warn;
    var flushCurrentErrorIfNew = cache(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- cache key
      (key) => {
        try {
          logErrorOrWarn(errorRef.current);
        } finally {
          errorRef.current = null;
        }
      }
    );
    function createDedupedByCallsiteServerErrorLoggerDev(getMessage) {
      return function logDedupedError(...args) {
        const message = getMessage(...args);
        if (process.env.NODE_ENV !== "production") {
          var _stack;
          const callStackFrames = (_stack = new Error().stack) == null ? void 0 : _stack.split("\n");
          if (callStackFrames === void 0 || callStackFrames.length < 4) {
            logErrorOrWarn(message);
          } else {
            const key = callStackFrames[4];
            errorRef.current = message;
            flushCurrentErrorIfNew(key);
          }
        } else {
          logErrorOrWarn(message);
        }
      };
    }
  }
});

// node_modules/next/dist/server/app-render/action-async-storage-instance.js
var require_action_async_storage_instance = __commonJS({
  "node_modules/next/dist/server/app-render/action-async-storage-instance.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    Object.defineProperty(exports2, "actionAsyncStorageInstance", {
      enumerable: true,
      get: function() {
        return actionAsyncStorageInstance;
      }
    });
    var _asynclocalstorage = require_async_local_storage();
    var actionAsyncStorageInstance = (0, _asynclocalstorage.createAsyncLocalStorage)();
  }
});

// node_modules/next/dist/server/app-render/action-async-storage.external.js
var require_action_async_storage_external = __commonJS({
  "node_modules/next/dist/server/app-render/action-async-storage.external.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    Object.defineProperty(exports2, "actionAsyncStorage", {
      enumerable: true,
      get: function() {
        return _actionasyncstorageinstance.actionAsyncStorageInstance;
      }
    });
    var _actionasyncstorageinstance = require_action_async_storage_instance();
  }
});

// node_modules/next/dist/server/app-render/after-task-async-storage-instance.js
var require_after_task_async_storage_instance = __commonJS({
  "node_modules/next/dist/server/app-render/after-task-async-storage-instance.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    Object.defineProperty(exports2, "afterTaskAsyncStorageInstance", {
      enumerable: true,
      get: function() {
        return afterTaskAsyncStorageInstance;
      }
    });
    var _asynclocalstorage = require_async_local_storage();
    var afterTaskAsyncStorageInstance = (0, _asynclocalstorage.createAsyncLocalStorage)();
  }
});

// node_modules/next/dist/server/app-render/after-task-async-storage.external.js
var require_after_task_async_storage_external = __commonJS({
  "node_modules/next/dist/server/app-render/after-task-async-storage.external.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    Object.defineProperty(exports2, "afterTaskAsyncStorage", {
      enumerable: true,
      get: function() {
        return _aftertaskasyncstorageinstance.afterTaskAsyncStorageInstance;
      }
    });
    var _aftertaskasyncstorageinstance = require_after_task_async_storage_instance();
  }
});

// node_modules/next/dist/server/request/utils.js
var require_utils = __commonJS({
  "node_modules/next/dist/server/request/utils.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    _export(exports2, {
      isRequestApiAllowedInCurrentPhase: function() {
        return isRequestApiAllowedInCurrentPhase;
      },
      throwForSearchParamsAccessInUseCache: function() {
        return throwForSearchParamsAccessInUseCache;
      },
      throwWithStaticGenerationBailoutErrorWithDynamicError: function() {
        return throwWithStaticGenerationBailoutErrorWithDynamicError;
      }
    });
    var _staticgenerationbailout = require_static_generation_bailout();
    var _actionasyncstorageexternal = require_action_async_storage_external();
    var _aftertaskasyncstorageexternal = require_after_task_async_storage_external();
    function throwWithStaticGenerationBailoutErrorWithDynamicError(route, expression) {
      throw Object.defineProperty(new _staticgenerationbailout.StaticGenBailoutError(`Route ${route} with \`dynamic = "error"\` couldn't be rendered statically because it used ${expression}. See more info here: https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic#dynamic-rendering`), "__NEXT_ERROR_CODE", {
        value: "E543",
        enumerable: false,
        configurable: true
      });
    }
    function throwForSearchParamsAccessInUseCache(workStore, constructorOpt) {
      const error = Object.defineProperty(new Error(`Route ${workStore.route} used \`searchParams\` inside "use cache". Accessing dynamic request data inside a cache scope is not supported. If you need some search params inside a cached function await \`searchParams\` outside of the cached function and pass only the required search params as arguments to the cached function. See more info here: https://nextjs.org/docs/messages/next-request-in-use-cache`), "__NEXT_ERROR_CODE", {
        value: "E842",
        enumerable: false,
        configurable: true
      });
      Error.captureStackTrace(error, constructorOpt);
      workStore.invalidDynamicUsageError ??= error;
      throw error;
    }
    function isRequestApiAllowedInCurrentPhase(workUnitStore) {
      switch (workUnitStore.phase) {
        case "action":
        case "render": {
          return true;
        }
        case "after": {
          const actionStore = _actionasyncstorageexternal.actionAsyncStorage.getStore();
          if (actionStore && (actionStore.isAppRoute || actionStore.isAction)) {
            return true;
          }
          const afterTaskStore = _aftertaskasyncstorageexternal.afterTaskAsyncStorage.getStore();
          if (afterTaskStore) {
            return afterTaskStore.rootTaskSpawnPhase === "action";
          }
          return false;
        }
      }
    }
  }
});

// node_modules/next/dist/server/request/cookies.js
var require_cookies3 = __commonJS({
  "node_modules/next/dist/server/request/cookies.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    Object.defineProperty(exports2, "cookies", {
      enumerable: true,
      get: function() {
        return cookies2;
      }
    });
    var _requestcookies = require_request_cookies();
    var _cookies = require_cookies2();
    var _workasyncstorageexternal = require_work_async_storage_external();
    var _workunitasyncstorageexternal = require_work_unit_async_storage_external();
    var _dynamicrendering = require_dynamic_rendering();
    var _staticgenerationbailout = require_static_generation_bailout();
    var _dynamicrenderingutils = require_dynamic_rendering_utils();
    var _creatededupedbycallsiteservererrorlogger = require_create_deduped_by_callsite_server_error_logger();
    var _utils = require_utils();
    var _invarianterror = require_invariant_error();
    function cookies2() {
      const callingExpression = "cookies";
      const workStore = _workasyncstorageexternal.workAsyncStorage.getStore();
      const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
      if (workStore) {
        if (workUnitStore && !(0, _utils.isRequestApiAllowedInCurrentPhase)(workUnitStore)) {
          throw Object.defineProperty(new Error(`Route ${workStore.route} used \`cookies()\` inside \`after()\` while rendering. This is not supported. If you need this data inside an \`after()\` callback, use \`cookies()\` outside of the callback. See more info here: https://nextjs.org/docs/app/api-reference/functions/after`), "__NEXT_ERROR_CODE", {
            value: "E1381",
            enumerable: false,
            configurable: true
          });
        }
        if (workStore.forceStatic) {
          const underlyingCookies = createEmptyCookies();
          return makeUntrackedCookies(underlyingCookies);
        }
        if (workStore.dynamicShouldError) {
          throw Object.defineProperty(new _staticgenerationbailout.StaticGenBailoutError(`Route ${workStore.route} with \`dynamic = "error"\` couldn't be rendered statically because it used \`cookies()\`. See more info here: https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic#dynamic-rendering`), "__NEXT_ERROR_CODE", {
            value: "E849",
            enumerable: false,
            configurable: true
          });
        }
        if (workUnitStore) {
          switch (workUnitStore.type) {
            case "cache":
              const error = Object.defineProperty(new Error(`Route ${workStore.route} used \`cookies()\` inside "use cache". Accessing Dynamic data sources inside a cache scope is not supported. If you need this data inside a cached function use \`cookies()\` outside of the cached function and pass the required dynamic data in as an argument. See more info here: https://nextjs.org/docs/messages/next-request-in-use-cache`), "__NEXT_ERROR_CODE", {
                value: "E831",
                enumerable: false,
                configurable: true
              });
              Error.captureStackTrace(error, cookies2);
              (0, _dynamicrenderingutils.applyOwnerStack)(error);
              workStore.invalidDynamicUsageError ??= error;
              throw error;
            case "unstable-cache":
              throw Object.defineProperty(new Error(`Route ${workStore.route} used \`cookies()\` inside a function cached with \`unstable_cache()\`. Accessing Dynamic data sources inside a cache scope is not supported. If you need this data inside a cached function use \`cookies()\` outside of the cached function and pass the required dynamic data in as an argument. See more info here: https://nextjs.org/docs/app/api-reference/functions/unstable_cache`), "__NEXT_ERROR_CODE", {
                value: "E846",
                enumerable: false,
                configurable: true
              });
            case "generate-static-params":
              throw Object.defineProperty(new Error(`Route ${workStore.route} used \`cookies()\` inside \`generateStaticParams\`. This is not supported because \`generateStaticParams\` runs at build time without an HTTP request. Read more: https://nextjs.org/docs/messages/next-dynamic-api-wrong-context`), "__NEXT_ERROR_CODE", {
                value: "E1123",
                enumerable: false,
                configurable: true
              });
            case "prerender":
              return makeHangingCookies(workStore, workUnitStore);
            case "prerender-client":
            case "validation-client":
              const exportName = "`cookies`";
              throw Object.defineProperty(new _invarianterror.InvariantError(`${exportName} must not be used within a Client Component. Next.js should be preventing ${exportName} from being included in Client Components statically, but did not in this case.`), "__NEXT_ERROR_CODE", {
                value: "E1037",
                enumerable: false,
                configurable: true
              });
            case "prerender-ppr":
              return (0, _dynamicrendering.postponeWithTracking)(workStore.route, callingExpression, workUnitStore.dynamicTracking);
            case "prerender-legacy":
              return (0, _dynamicrendering.throwToInterruptStaticGeneration)(callingExpression, workStore, workUnitStore);
            case "prerender-runtime": {
              const { stagedRendering } = workUnitStore;
              if (stagedRendering) {
                return stagedRendering.delayUntilStage(_dynamicrenderingutils.RENDER_STAGES_BY_DATA_KIND.sessionData, "cookies", workUnitStore.cookies);
              } else {
                return makeUntrackedCookies(workUnitStore.cookies);
              }
            }
            case "private-cache":
              return makeUntrackedCookies(workUnitStore.cookies);
            case "request":
              (0, _dynamicrendering.trackDynamicDataInDynamicRender)(workUnitStore);
              let underlyingCookies;
              if ((0, _requestcookies.areCookiesMutableInCurrentPhase)(workUnitStore)) {
                underlyingCookies = workUnitStore.userspaceMutableCookies;
              } else {
                underlyingCookies = workUnitStore.cookies;
              }
              if (process.env.NODE_ENV === "development") {
                return makeUntrackedCookiesWithDevWarnings(workUnitStore, underlyingCookies, workStore == null ? void 0 : workStore.route);
              } else if (workUnitStore.asyncApiPromises) {
                if (underlyingCookies === workUnitStore.mutableCookies) {
                  return workUnitStore.asyncApiPromises.mutableCookies;
                } else {
                  return workUnitStore.asyncApiPromises.cookies;
                }
              } else {
                return makeUntrackedCookies(underlyingCookies);
              }
            default:
              workUnitStore;
          }
        }
      }
      (0, _workunitasyncstorageexternal.throwForMissingRequestStore)(callingExpression);
    }
    function createEmptyCookies() {
      return _requestcookies.RequestCookiesAdapter.seal(new _cookies.RequestCookies(new Headers({})));
    }
    var CachedCookies = /* @__PURE__ */ new WeakMap();
    function makeHangingCookies(workStore, prerenderStore) {
      const cachedPromise = CachedCookies.get(prerenderStore);
      if (cachedPromise) {
        return cachedPromise;
      }
      const promise = (0, _dynamicrenderingutils.makeRuntimeHangingPromise)(prerenderStore.renderSignal, workStore.route, "`cookies()`", prerenderStore);
      CachedCookies.set(prerenderStore, promise);
      return promise;
    }
    function makeUntrackedCookies(underlyingCookies) {
      const cachedCookies = CachedCookies.get(underlyingCookies);
      if (cachedCookies) {
        return cachedCookies;
      }
      const promise = Promise.resolve(underlyingCookies);
      CachedCookies.set(underlyingCookies, promise);
      return promise;
    }
    function makeUntrackedCookiesWithDevWarnings(requestStore, underlyingCookies, route) {
      if (requestStore.asyncApiPromises) {
        let promise2;
        if (underlyingCookies === requestStore.mutableCookies) {
          promise2 = requestStore.asyncApiPromises.mutableCookies;
        } else if (underlyingCookies === requestStore.cookies) {
          promise2 = requestStore.asyncApiPromises.cookies;
        } else {
          throw Object.defineProperty(new _invarianterror.InvariantError("Received an underlying cookies object that does not match either `cookies` or `mutableCookies`"), "__NEXT_ERROR_CODE", {
            value: "E890",
            enumerable: false,
            configurable: true
          });
        }
        return instrumentCookiesPromiseWithDevWarnings(promise2, route);
      }
      const cachedCookies = CachedCookies.get(underlyingCookies);
      if (cachedCookies) {
        return cachedCookies;
      }
      const promise = (0, _dynamicrenderingutils.makeDevtoolsIOAwarePromise)(underlyingCookies, requestStore, _dynamicrenderingutils.RENDER_STAGES_BY_DATA_KIND.sessionData);
      const proxiedPromise = instrumentCookiesPromiseWithDevWarnings(promise, route);
      CachedCookies.set(underlyingCookies, proxiedPromise);
      return proxiedPromise;
    }
    var warnForSyncAccess = (0, _creatededupedbycallsiteservererrorlogger.createDedupedByCallsiteServerErrorLoggerDev)(createCookiesAccessError);
    function instrumentCookiesPromiseWithDevWarnings(promise, route) {
      Object.defineProperties(promise, {
        [Symbol.iterator]: replaceableWarningDescriptorForSymbolIterator(promise, route),
        size: replaceableWarningDescriptor(promise, "size", route),
        get: replaceableWarningDescriptor(promise, "get", route),
        getAll: replaceableWarningDescriptor(promise, "getAll", route),
        has: replaceableWarningDescriptor(promise, "has", route),
        set: replaceableWarningDescriptor(promise, "set", route),
        delete: replaceableWarningDescriptor(promise, "delete", route),
        clear: replaceableWarningDescriptor(promise, "clear", route),
        toString: replaceableWarningDescriptor(promise, "toString", route)
      });
      return promise;
    }
    function replaceableWarningDescriptor(target, prop, route) {
      return {
        enumerable: false,
        get() {
          warnForSyncAccess(route, `\`cookies().${prop}\``);
          return void 0;
        },
        set(value) {
          Object.defineProperty(target, prop, {
            value,
            writable: true,
            configurable: true
          });
        },
        configurable: true
      };
    }
    function replaceableWarningDescriptorForSymbolIterator(target, route) {
      return {
        enumerable: false,
        get() {
          warnForSyncAccess(route, "`...cookies()` or similar iteration");
          return void 0;
        },
        set(value) {
          Object.defineProperty(target, Symbol.iterator, {
            value,
            writable: true,
            enumerable: true,
            configurable: true
          });
        },
        configurable: true
      };
    }
    function createCookiesAccessError(route, expression) {
      const prefix = route ? `Route "${route}" ` : "This route ";
      return Object.defineProperty(new Error(`${prefix}used ${expression}. \`cookies()\` returns a Promise and must be unwrapped with \`await\` or \`React.use()\` before accessing its properties. Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis`), "__NEXT_ERROR_CODE", {
        value: "E830",
        enumerable: false,
        configurable: true
      });
    }
  }
});

// node_modules/next/dist/server/web/spec-extension/adapters/headers.js
var require_headers = __commonJS({
  "node_modules/next/dist/server/web/spec-extension/adapters/headers.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    function _export(target, all) {
      for (var name in all) Object.defineProperty(target, name, {
        enumerable: true,
        get: all[name]
      });
    }
    _export(exports2, {
      HeadersAdapter: function() {
        return HeadersAdapter;
      },
      ReadonlyHeadersError: function() {
        return ReadonlyHeadersError;
      }
    });
    var _reflect = require_reflect();
    var ReadonlyHeadersError = class _ReadonlyHeadersError extends Error {
      constructor() {
        super("Headers cannot be modified. Read more: https://nextjs.org/docs/app/api-reference/functions/headers");
        Object.defineProperty(this, "__NEXT_ERROR_CODE", {
          value: "E1176",
          enumerable: false,
          configurable: true
        });
      }
      static callable() {
        throw new _ReadonlyHeadersError();
      }
    };
    function createPassThroughMethods(target, sealed) {
      return {
        get: target.get.bind(target),
        has: target.has.bind(target),
        getSetCookie: target.getSetCookie.bind(target),
        keys: target.keys.bind(target),
        values: target.values.bind(target),
        entries: target.entries.bind(target),
        [Symbol.iterator]: target[Symbol.iterator].bind(target),
        // The native method passes the unsealed target as the callback's `parent`
        // argument. That is a mutable handle on the underlying headers. Pass the
        // sealed view instead.
        forEach(callbackfn, thisArg) {
          for (const [name, value] of target.entries()) {
            callbackfn.call(thisArg, value, name, sealed);
          }
        }
      };
    }
    function createHidingMethods(target, sealed, isHidden) {
      function* entries() {
        for (const entry of target.entries()) {
          if (!isHidden(entry[0])) {
            yield entry;
          }
        }
      }
      return {
        entries,
        [Symbol.iterator]: entries,
        get: (name) => isHidden(name) ? null : target.get(name),
        has: (name) => isHidden(name) ? false : target.has(name),
        getSetCookie: () => isHidden("set-cookie") ? [] : target.getSetCookie(),
        *keys() {
          for (const name of target.keys()) {
            if (!isHidden(name)) {
              yield name;
            }
          }
        },
        *values() {
          for (const [, value] of entries()) {
            yield value;
          }
        },
        // The native method passes the unsealed target as the callback's `parent`
        // argument. That is a mutable handle on the underlying headers. Pass the
        // sealed view instead.
        forEach(callbackfn, thisArg) {
          for (const [name, value] of entries()) {
            callbackfn.call(thisArg, value, name, sealed);
          }
        }
      };
    }
    var HeadersAdapter = class _HeadersAdapter extends Headers {
      constructor(headers) {
        super();
        this.headers = new Proxy(headers, {
          get(target, prop, receiver) {
            if (typeof prop === "symbol") {
              return _reflect.ReflectAdapter.get(target, prop, receiver);
            }
            const lowercased = prop.toLowerCase();
            const original = Object.keys(headers).find((o) => o.toLowerCase() === lowercased);
            if (typeof original === "undefined") return;
            return _reflect.ReflectAdapter.get(target, original, receiver);
          },
          set(target, prop, value, receiver) {
            if (typeof prop === "symbol") {
              return _reflect.ReflectAdapter.set(target, prop, value, receiver);
            }
            const lowercased = prop.toLowerCase();
            const original = Object.keys(headers).find((o) => o.toLowerCase() === lowercased);
            return _reflect.ReflectAdapter.set(target, original ?? prop, value, receiver);
          },
          has(target, prop) {
            if (typeof prop === "symbol") return _reflect.ReflectAdapter.has(target, prop);
            const lowercased = prop.toLowerCase();
            const original = Object.keys(headers).find((o) => o.toLowerCase() === lowercased);
            if (typeof original === "undefined") return false;
            return _reflect.ReflectAdapter.has(target, original);
          },
          deleteProperty(target, prop) {
            if (typeof prop === "symbol") return _reflect.ReflectAdapter.deleteProperty(target, prop);
            const lowercased = prop.toLowerCase();
            const original = Object.keys(headers).find((o) => o.toLowerCase() === lowercased);
            if (typeof original === "undefined") return true;
            return _reflect.ReflectAdapter.deleteProperty(target, original);
          }
        });
      }
      /**
      * Seals a Headers instance to prevent modification by throwing an error when
      * any mutating method is called.
      *
      * The sealed view stays live. Later writes to `headers` remain visible
      * through it.
      *
      * `hidden` omits the given header names from every read operation (`get`,
      * `has`, `getSetCookie`, `forEach`, and iteration). The names must be
      * lowercase. The underlying headers are neither copied nor mutated, so hidden
      * headers remain available to the framework.
      */
      static seal(headers, hidden) {
        const isHidden = hidden && hidden.size > 0 ? (name) => hidden.has(name.toLowerCase()) : null;
        let methods;
        const sealed = new Proxy(headers, {
          get(target, prop, receiver) {
            switch (prop) {
              case "append":
              case "delete":
              case "set":
                return ReadonlyHeadersError.callable;
              case Symbol.iterator:
                return methods[Symbol.iterator];
              case "get":
              case "has":
              case "getSetCookie":
              case "keys":
              case "values":
              case "entries":
              case "forEach":
                return methods[prop];
              default:
                return _reflect.ReflectAdapter.get(target, prop, receiver);
            }
          }
        });
        methods = isHidden ? createHidingMethods(headers, sealed, isHidden) : createPassThroughMethods(headers, sealed);
        return sealed;
      }
      /**
      * @param headers
      * @returns A fresh object identity backed by the original value
      */
      static fresh(headers) {
        return new Proxy(headers, {
          get(target, prop, receiver) {
            return _reflect.ReflectAdapter.get(target, prop, receiver);
          }
        });
      }
      /**
      * Merges a header value into a string. This stores multiple values as an
      * array, so we need to merge them into a string.
      *
      * @param value a header value
      * @returns a merged header value (a string)
      */
      merge(value) {
        if (Array.isArray(value)) return value.join(", ");
        return value;
      }
      /**
      * Creates a Headers instance from a plain object or a Headers instance.
      *
      * @param headers a plain object or a Headers instance
      * @returns a headers instance
      */
      static from(headers) {
        if (headers instanceof Headers) return headers;
        return new _HeadersAdapter(headers);
      }
      append(name, value) {
        const existing = this.headers[name];
        if (typeof existing === "string") {
          this.headers[name] = [
            existing,
            value
          ];
        } else if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          this.headers[name] = value;
        }
      }
      delete(name) {
        delete this.headers[name];
      }
      get(name) {
        const value = this.headers[name];
        if (typeof value !== "undefined") return this.merge(value);
        return null;
      }
      has(name) {
        return typeof this.headers[name] !== "undefined";
      }
      set(name, value) {
        this.headers[name] = value;
      }
      forEach(callbackfn, thisArg) {
        for (const [name, value] of this.entries()) {
          callbackfn.call(thisArg, value, name, this);
        }
      }
      *entries() {
        for (const key of Object.keys(this.headers)) {
          const name = key.toLowerCase();
          const value = this.get(name);
          yield [
            name,
            value
          ];
        }
      }
      *keys() {
        for (const key of Object.keys(this.headers)) {
          const name = key.toLowerCase();
          yield name;
        }
      }
      *values() {
        for (const key of Object.keys(this.headers)) {
          const value = this.get(key);
          yield value;
        }
      }
      [Symbol.iterator]() {
        return this.entries();
      }
    };
  }
});

// node_modules/next/dist/server/request/headers.js
var require_headers2 = __commonJS({
  "node_modules/next/dist/server/request/headers.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    Object.defineProperty(exports2, "headers", {
      enumerable: true,
      get: function() {
        return headers;
      }
    });
    var _headers = require_headers();
    var _workasyncstorageexternal = require_work_async_storage_external();
    var _workunitasyncstorageexternal = require_work_unit_async_storage_external();
    var _dynamicrendering = require_dynamic_rendering();
    var _staticgenerationbailout = require_static_generation_bailout();
    var _dynamicrenderingutils = require_dynamic_rendering_utils();
    var _creatededupedbycallsiteservererrorlogger = require_create_deduped_by_callsite_server_error_logger();
    var _utils = require_utils();
    var _invarianterror = require_invariant_error();
    function headers() {
      const callingExpression = "headers";
      const workStore = _workasyncstorageexternal.workAsyncStorage.getStore();
      const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
      if (workStore) {
        if (workUnitStore && !(0, _utils.isRequestApiAllowedInCurrentPhase)(workUnitStore)) {
          throw Object.defineProperty(new Error(`Route ${workStore.route} used \`headers()\` inside \`after()\` while rendering. This is not supported. If you need this data inside an \`after()\` callback, use \`headers()\` outside of the callback. See more info here: https://nextjs.org/docs/app/api-reference/functions/after`), "__NEXT_ERROR_CODE", {
            value: "E1378",
            enumerable: false,
            configurable: true
          });
        }
        if (workStore.forceStatic) {
          const underlyingHeaders = _headers.HeadersAdapter.seal(new Headers({}));
          return makeUntrackedHeaders(underlyingHeaders);
        }
        if (workUnitStore) {
          switch (workUnitStore.type) {
            case "cache": {
              const error = Object.defineProperty(new Error(`Route ${workStore.route} used \`headers()\` inside "use cache". Accessing Dynamic data sources inside a cache scope is not supported. If you need this data inside a cached function use \`headers()\` outside of the cached function and pass the required dynamic data in as an argument. See more info here: https://nextjs.org/docs/messages/next-request-in-use-cache`), "__NEXT_ERROR_CODE", {
                value: "E833",
                enumerable: false,
                configurable: true
              });
              Error.captureStackTrace(error, headers);
              (0, _dynamicrenderingutils.applyOwnerStack)(error);
              workStore.invalidDynamicUsageError ??= error;
              throw error;
            }
            case "unstable-cache":
              throw Object.defineProperty(new Error(`Route ${workStore.route} used \`headers()\` inside a function cached with \`unstable_cache()\`. Accessing Dynamic data sources inside a cache scope is not supported. If you need this data inside a cached function use \`headers()\` outside of the cached function and pass the required dynamic data in as an argument. See more info here: https://nextjs.org/docs/app/api-reference/functions/unstable_cache`), "__NEXT_ERROR_CODE", {
                value: "E838",
                enumerable: false,
                configurable: true
              });
            case "generate-static-params":
              throw Object.defineProperty(new Error(`Route ${workStore.route} used \`headers()\` inside \`generateStaticParams\`. This is not supported because \`generateStaticParams\` runs at build time without an HTTP request. Read more: https://nextjs.org/docs/messages/next-dynamic-api-wrong-context`), "__NEXT_ERROR_CODE", {
                value: "E1134",
                enumerable: false,
                configurable: true
              });
            case "prerender":
            case "prerender-client":
            case "validation-client":
            case "private-cache":
            case "prerender-runtime":
            case "prerender-ppr":
            case "prerender-legacy":
            case "request":
              break;
            default:
              workUnitStore;
          }
        }
        if (workStore.dynamicShouldError) {
          throw Object.defineProperty(new _staticgenerationbailout.StaticGenBailoutError(`Route ${workStore.route} with \`dynamic = "error"\` couldn't be rendered statically because it used \`headers()\`. See more info here: https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic#dynamic-rendering`), "__NEXT_ERROR_CODE", {
            value: "E828",
            enumerable: false,
            configurable: true
          });
        }
        if (workUnitStore) {
          switch (workUnitStore.type) {
            case "prerender":
              return makeHangingHeaders(workStore, workUnitStore);
            case "prerender-client":
            case "validation-client":
              const exportName = "`headers`";
              throw Object.defineProperty(new _invarianterror.InvariantError(`${exportName} must not be used within a client component. Next.js should be preventing ${exportName} from being included in client components statically, but did not in this case.`), "__NEXT_ERROR_CODE", {
                value: "E1017",
                enumerable: false,
                configurable: true
              });
            case "prerender-ppr":
              return (0, _dynamicrendering.postponeWithTracking)(workStore.route, callingExpression, workUnitStore.dynamicTracking);
            case "prerender-legacy":
              return (0, _dynamicrendering.throwToInterruptStaticGeneration)(callingExpression, workStore, workUnitStore);
            case "prerender-runtime": {
              const { stagedRendering } = workUnitStore;
              if (stagedRendering) {
                return stagedRendering.delayUntilStage(_dynamicrenderingutils.RENDER_STAGES_BY_DATA_KIND.sessionData, "headers", workUnitStore.headers);
              } else {
                return makeUntrackedHeaders(workUnitStore.headers);
              }
            }
            case "private-cache":
              return makeUntrackedHeaders(workUnitStore.headers);
            case "request":
              (0, _dynamicrendering.trackDynamicDataInDynamicRender)(workUnitStore);
              if (process.env.NODE_ENV === "development") {
                return makeUntrackedHeadersWithDevWarnings(workUnitStore.headers, workStore == null ? void 0 : workStore.route, workUnitStore);
              } else if (workUnitStore.asyncApiPromises) {
                return workUnitStore.asyncApiPromises.headers;
              } else {
                return makeUntrackedHeaders(workUnitStore.headers);
              }
              break;
            default:
              workUnitStore;
          }
        }
      }
      (0, _workunitasyncstorageexternal.throwForMissingRequestStore)(callingExpression);
    }
    var CachedHeaders = /* @__PURE__ */ new WeakMap();
    function makeHangingHeaders(workStore, prerenderStore) {
      const cachedHeaders = CachedHeaders.get(prerenderStore);
      if (cachedHeaders) {
        return cachedHeaders;
      }
      const promise = (0, _dynamicrenderingutils.makeRuntimeHangingPromise)(prerenderStore.renderSignal, workStore.route, "`headers()`", prerenderStore);
      CachedHeaders.set(prerenderStore, promise);
      return promise;
    }
    function makeUntrackedHeaders(underlyingHeaders) {
      const cachedHeaders = CachedHeaders.get(underlyingHeaders);
      if (cachedHeaders) {
        return cachedHeaders;
      }
      const promise = Promise.resolve(underlyingHeaders);
      CachedHeaders.set(underlyingHeaders, promise);
      return promise;
    }
    function makeUntrackedHeadersWithDevWarnings(underlyingHeaders, route, requestStore) {
      if (requestStore.asyncApiPromises) {
        return instrumentHeadersPromiseWithDevWarnings(requestStore.asyncApiPromises.headers, route);
      }
      const cachedHeaders = CachedHeaders.get(underlyingHeaders);
      if (cachedHeaders) {
        return cachedHeaders;
      }
      const promise = (0, _dynamicrenderingutils.makeDevtoolsIOAwarePromise)(underlyingHeaders, requestStore, _dynamicrenderingutils.RENDER_STAGES_BY_DATA_KIND.sessionData);
      const proxiedPromise = instrumentHeadersPromiseWithDevWarnings(promise, route);
      CachedHeaders.set(underlyingHeaders, proxiedPromise);
      return proxiedPromise;
    }
    var warnForSyncAccess = (0, _creatededupedbycallsiteservererrorlogger.createDedupedByCallsiteServerErrorLoggerDev)(createHeadersAccessError);
    function instrumentHeadersPromiseWithDevWarnings(promise, route) {
      Object.defineProperties(promise, {
        [Symbol.iterator]: replaceableWarningDescriptorForSymbolIterator(promise, route),
        append: replaceableWarningDescriptor(promise, "append", route),
        delete: replaceableWarningDescriptor(promise, "delete", route),
        get: replaceableWarningDescriptor(promise, "get", route),
        has: replaceableWarningDescriptor(promise, "has", route),
        set: replaceableWarningDescriptor(promise, "set", route),
        getSetCookie: replaceableWarningDescriptor(promise, "getSetCookie", route),
        forEach: replaceableWarningDescriptor(promise, "forEach", route),
        keys: replaceableWarningDescriptor(promise, "keys", route),
        values: replaceableWarningDescriptor(promise, "values", route),
        entries: replaceableWarningDescriptor(promise, "entries", route)
      });
      return promise;
    }
    function replaceableWarningDescriptor(target, prop, route) {
      return {
        enumerable: false,
        get() {
          warnForSyncAccess(route, `\`headers().${prop}\``);
          return void 0;
        },
        set(value) {
          Object.defineProperty(target, prop, {
            value,
            writable: true,
            configurable: true
          });
        },
        configurable: true
      };
    }
    function replaceableWarningDescriptorForSymbolIterator(target, route) {
      return {
        enumerable: false,
        get() {
          warnForSyncAccess(route, "`...headers()` or similar iteration");
          return void 0;
        },
        set(value) {
          Object.defineProperty(target, Symbol.iterator, {
            value,
            writable: true,
            enumerable: true,
            configurable: true
          });
        },
        configurable: true
      };
    }
    function createHeadersAccessError(route, expression) {
      const prefix = route ? `Route "${route}" ` : "This route ";
      return Object.defineProperty(new Error(`${prefix}used ${expression}. \`headers()\` returns a Promise and must be unwrapped with \`await\` or \`React.use()\` before accessing its properties. Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis`), "__NEXT_ERROR_CODE", {
        value: "E836",
        enumerable: false,
        configurable: true
      });
    }
  }
});

// node_modules/next/dist/server/request/draft-mode.js
var require_draft_mode = __commonJS({
  "node_modules/next/dist/server/request/draft-mode.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", {
      value: true
    });
    Object.defineProperty(exports2, "draftMode", {
      enumerable: true,
      get: function() {
        return draftMode;
      }
    });
    var _workunitasyncstorageexternal = require_work_unit_async_storage_external();
    var _workasyncstorageexternal = require_work_async_storage_external();
    var _dynamicrendering = require_dynamic_rendering();
    var _creatededupedbycallsiteservererrorlogger = require_create_deduped_by_callsite_server_error_logger();
    var _staticgenerationbailout = require_static_generation_bailout();
    var _hooksservercontext = require_hooks_server_context();
    var _invarianterror = require_invariant_error();
    var _reflect = require_reflect();
    var _dynamicrenderingutils = require_dynamic_rendering_utils();
    function draftMode() {
      const callingExpression = "draftMode";
      const workStore = _workasyncstorageexternal.workAsyncStorage.getStore();
      const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
      if (!workStore || !workUnitStore) {
        (0, _workunitasyncstorageexternal.throwForMissingRequestStore)(callingExpression);
      }
      switch (workUnitStore.type) {
        case "prerender-runtime": {
          const { stagedRendering } = workUnitStore;
          if (stagedRendering) {
            return stagedRendering.delayUntilStage(_dynamicrenderingutils.RENDER_STAGES_BY_DATA_KIND.sessionData, "draftMode", new DraftMode(workUnitStore.draftMode));
          } else {
            return createOrGetCachedDraftMode(workUnitStore.draftMode, workStore);
          }
        }
        case "request":
          return createOrGetCachedDraftMode(workUnitStore.draftMode, workStore);
        case "cache":
        case "private-cache":
        case "unstable-cache":
          const draftModeProvider = (0, _workunitasyncstorageexternal.getDraftModeProviderForCacheScope)(workStore, workUnitStore);
          if (draftModeProvider) {
            return createOrGetCachedDraftMode(draftModeProvider, workStore);
          }
        case "prerender":
        case "prerender-ppr":
        case "prerender-legacy":
          return createOrGetCachedDraftMode(null, workStore);
        case "prerender-client":
        case "validation-client": {
          const exportName = "`draftMode`";
          throw Object.defineProperty(new _invarianterror.InvariantError(`${exportName} must not be used within a Client Component. Next.js should be preventing ${exportName} from being included in Client Components statically, but did not in this case.`), "__NEXT_ERROR_CODE", {
            value: "E1046",
            enumerable: false,
            configurable: true
          });
        }
        case "generate-static-params":
          throw Object.defineProperty(new Error(`Route ${workStore.route} used \`${callingExpression}()\` inside \`generateStaticParams\`. This is not supported because \`generateStaticParams\` runs at build time without an HTTP request. Read more: https://nextjs.org/docs/messages/next-dynamic-api-wrong-context`), "__NEXT_ERROR_CODE", {
            value: "E1132",
            enumerable: false,
            configurable: true
          });
        default:
          return workUnitStore;
      }
    }
    function createOrGetCachedDraftMode(draftModeProvider, workStore) {
      const cacheKey = draftModeProvider ?? NullDraftMode;
      const cachedDraftMode = CachedDraftModes.get(cacheKey);
      if (cachedDraftMode) {
        return cachedDraftMode;
      }
      if (process.env.NODE_ENV === "development" && !(workStore == null ? void 0 : workStore.isPrefetchRequest)) {
        const route = workStore == null ? void 0 : workStore.route;
        return createDraftModeWithDevWarnings(draftModeProvider, route);
      } else {
        return Promise.resolve(new DraftMode(draftModeProvider));
      }
    }
    var NullDraftMode = {};
    var CachedDraftModes = /* @__PURE__ */ new WeakMap();
    function createDraftModeWithDevWarnings(underlyingProvider, route) {
      const instance = new DraftMode(underlyingProvider);
      const promise = Promise.resolve(instance);
      const proxiedPromise = new Proxy(promise, {
        get(target, prop, receiver) {
          switch (prop) {
            case "isEnabled":
              warnForSyncAccess(route, `\`draftMode().${prop}\``);
              break;
            case "enable":
            case "disable": {
              warnForSyncAccess(route, `\`draftMode().${prop}()\``);
              break;
            }
            default: {
            }
          }
          return _reflect.ReflectAdapter.get(target, prop, receiver);
        }
      });
      return proxiedPromise;
    }
    var DraftMode = class {
      constructor(provider) {
        this._provider = provider;
      }
      get isEnabled() {
        if (this._provider !== null) {
          return this._provider.isEnabled;
        }
        return false;
      }
      enable() {
        trackDynamicDraftMode("draftMode().enable()", this.enable);
        if (this._provider !== null) {
          this._provider.enable();
        }
      }
      disable() {
        trackDynamicDraftMode("draftMode().disable()", this.disable);
        if (this._provider !== null) {
          this._provider.disable();
        }
      }
    };
    var warnForSyncAccess = (0, _creatededupedbycallsiteservererrorlogger.createDedupedByCallsiteServerErrorLoggerDev)(createDraftModeAccessError);
    function createDraftModeAccessError(route, expression) {
      const prefix = route ? `Route "${route}" ` : "This route ";
      return Object.defineProperty(new Error(`${prefix}used ${expression}. \`draftMode()\` returns a Promise and must be unwrapped with \`await\` or \`React.use()\` before accessing its properties. Learn more: https://nextjs.org/docs/messages/sync-dynamic-apis`), "__NEXT_ERROR_CODE", {
        value: "E835",
        enumerable: false,
        configurable: true
      });
    }
    function trackDynamicDraftMode(expression, constructorOpt) {
      const workStore = _workasyncstorageexternal.workAsyncStorage.getStore();
      const workUnitStore = _workunitasyncstorageexternal.workUnitAsyncStorage.getStore();
      if (workStore) {
        if ((workUnitStore == null ? void 0 : workUnitStore.phase) === "after") {
          throw Object.defineProperty(new Error(`Route ${workStore.route} used "${expression}" inside \`after()\`. The enabled status of \`draftMode()\` can be read inside \`after()\` but you cannot enable or disable \`draftMode()\`. See more info here: https://nextjs.org/docs/app/api-reference/functions/after`), "__NEXT_ERROR_CODE", {
            value: "E845",
            enumerable: false,
            configurable: true
          });
        }
        if (workStore.dynamicShouldError) {
          throw Object.defineProperty(new _staticgenerationbailout.StaticGenBailoutError(`Route ${workStore.route} with \`dynamic = "error"\` couldn't be rendered statically because it used \`${expression}\`. See more info here: https://nextjs.org/docs/app/building-your-application/rendering/static-and-dynamic#dynamic-rendering`), "__NEXT_ERROR_CODE", {
            value: "E553",
            enumerable: false,
            configurable: true
          });
        }
        if (workUnitStore) {
          switch (workUnitStore.type) {
            case "cache":
            case "private-cache": {
              const error = Object.defineProperty(new Error(`Route ${workStore.route} used "${expression}" inside "use cache". The enabled status of \`draftMode()\` can be read in caches but you must not enable or disable \`draftMode()\` inside a cache. See more info here: https://nextjs.org/docs/messages/next-request-in-use-cache`), "__NEXT_ERROR_CODE", {
                value: "E829",
                enumerable: false,
                configurable: true
              });
              Error.captureStackTrace(error, constructorOpt);
              (0, _dynamicrenderingutils.applyOwnerStack)(error);
              workStore.invalidDynamicUsageError ??= error;
              throw error;
            }
            case "unstable-cache":
              throw Object.defineProperty(new Error(`Route ${workStore.route} used "${expression}" inside a function cached with \`unstable_cache()\`. The enabled status of \`draftMode()\` can be read in caches but you must not enable or disable \`draftMode()\` inside a cache. See more info here: https://nextjs.org/docs/app/api-reference/functions/unstable_cache`), "__NEXT_ERROR_CODE", {
                value: "E844",
                enumerable: false,
                configurable: true
              });
            case "prerender":
            case "prerender-runtime": {
              const error = Object.defineProperty(new Error(`Route ${workStore.route} used ${expression} without first calling \`await connection()\`. See more info here: https://nextjs.org/docs/messages/next-prerender-sync-headers`), "__NEXT_ERROR_CODE", {
                value: "E126",
                enumerable: false,
                configurable: true
              });
              return (0, _dynamicrendering.abortAndThrowOnSynchronousRequestDataAccess)(workStore.route, expression, error, workUnitStore);
            }
            case "prerender-client":
            case "validation-client":
              const exportName = "`draftMode`";
              throw Object.defineProperty(new _invarianterror.InvariantError(`${exportName} must not be used within a Client Component. Next.js should be preventing ${exportName} from being included in Client Components statically, but did not in this case.`), "__NEXT_ERROR_CODE", {
                value: "E1046",
                enumerable: false,
                configurable: true
              });
            case "prerender-ppr":
              return (0, _dynamicrendering.postponeWithTracking)(workStore.route, expression, workUnitStore.dynamicTracking);
            case "prerender-legacy":
              workUnitStore.revalidate = 0;
              const err = Object.defineProperty(new _hooksservercontext.DynamicServerError(`Route ${workStore.route} couldn't be rendered statically because it used \`${expression}\`. See more info here: https://nextjs.org/docs/messages/dynamic-server-error`), "__NEXT_ERROR_CODE", {
                value: "E558",
                enumerable: false,
                configurable: true
              });
              workStore.dynamicUsageDescription = expression;
              workStore.dynamicUsageStack = err.stack;
              throw err;
            case "request":
              (0, _dynamicrendering.trackDynamicDataInDynamicRender)(workUnitStore);
              break;
            case "generate-static-params":
              throw Object.defineProperty(new Error(`Route ${workStore.route} used \`${expression}\` inside \`generateStaticParams\`. This is not supported because \`generateStaticParams\` runs at build time without an HTTP request. Read more: https://nextjs.org/docs/messages/next-dynamic-api-wrong-context`), "__NEXT_ERROR_CODE", {
                value: "E1121",
                enumerable: false,
                configurable: true
              });
            default:
              workUnitStore;
          }
        }
      }
    }
  }
});

// node_modules/next/headers.js
var require_headers3 = __commonJS({
  "node_modules/next/headers.js"(exports2, module2) {
    module2.exports.cookies = require_cookies3().cookies;
    module2.exports.headers = require_headers2().headers;
    module2.exports.draftMode = require_draft_mode().draftMode;
  }
});

// .tmp/content-audit-supplement_20261008.ts
var import_node_fs = __toESM(require("node:fs"));

// .tmp/content-audit-production_20261008/lib/dify-errors.ts
function isContextOverflowError(message) {
  return /context (window|length)|maximum context|too many tokens|prompt is too long|input (is )?too long|exceeds the model/i.test(
    message || ""
  );
}
function difyEventError(data) {
  if (!data || typeof data !== "object") return null;
  if (data.event === "error") return String(data.message || data.code || "\u751F\u6210\u5931\u8D25");
  if (data.event === "workflow_finished" && data.data?.status === "failed") {
    return String(data.data?.error || "\u5DE5\u4F5C\u6D41\u8FD0\u884C\u5931\u8D25");
  }
  return null;
}
var PAYLOAD_TOO_LARGE = /PayloadTooLarge|payload_bytes|request entity too large|\b413\b/i;
function friendlyDifyError(message) {
  if (isContextOverflowError(message)) return "\u8FD9\u6B21\u8981\u5904\u7406\u7684\u5185\u5BB9\u592A\u957F\u4E86\uFF0C\u5DF2\u7ECF\u4E3A\u4F60\u6362\u4E86\u4E00\u4E2A\u65B0\u7A97\u53E3\uFF0C\u8BF7\u518D\u70B9\u4E00\u6B21\u751F\u6210";
  if (PAYLOAD_TOO_LARGE.test(message)) return "\u8FD9\u6B21\u53D1\u7ED9 AI \u7684\u622A\u56FE\u592A\u5927\u4E86\uFF0C\u8BF7\u70B9\u300C\u91CD\u65B0\u62C6\u89E3\u300D\u518D\u8BD5\u4E00\u6B21";
  if (/rate limit|429|overloaded|529|too many requests/i.test(message)) return "AI \u8FD9\u4F1A\u513F\u592A\u5FD9\u4E86\uFF0C\u8BF7\u8FC7\u534A\u5206\u949F\u518D\u8BD5";
  if (/timeout|timed out/i.test(message)) return "AI \u54CD\u5E94\u8D85\u65F6\u4E86\uFF0C\u8BF7\u518D\u8BD5\u4E00\u6B21";
  return "\u751F\u6210\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5";
}

// lib/admin-auth.ts
var import_headers = __toESM(require_headers3());

// lib/supabase/fetch.ts
function createSupabaseFetch({
  authTimeoutMs = 12e3,
  requestTimeoutMs = 15e3,
  fetchImpl = (...args) => globalThis.fetch(...args)
} = {}) {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const isAuth = new URL(url).pathname.startsWith("/auth/v1/");
    const sourceSignal = init?.signal ?? (input instanceof Request ? input.signal : void 0);
    const controller = new AbortController();
    const forwardAbort = () => controller.abort(sourceSignal?.reason);
    if (sourceSignal?.aborted) forwardAbort();
    else sourceSignal?.addEventListener("abort", forwardAbort, { once: true });
    const timeout = setTimeout(() => {
      const error = new Error(isAuth ? "Authentication request timed out" : "Supabase request timed out");
      error.name = "TimeoutError";
      controller.abort(error);
    }, isAuth ? authTimeoutMs : requestTimeoutMs);
    try {
      const response = await fetchImpl(input, {
        ...init,
        ...isAuth ? { cache: "no-store" } : {},
        signal: controller.signal
      });
      if (response.body && (isAuth || response.headers.get("content-type")?.includes("json"))) {
        await response.clone().arrayBuffer();
      }
      return response;
    } finally {
      clearTimeout(timeout);
      sourceSignal?.removeEventListener("abort", forwardAbort);
    }
  };
}
var supabaseFetch = createSupabaseFetch();

// lib/config/plans.ts
var COUNTED_FEATURES = [
  { key: "script", column: "script_used", name: "\u811A\u672C\u751F\u6210" },
  { key: "topic", column: "topic_used", name: "\u9009\u9898\u7B56\u5212" },
  { key: "positioning", column: "positioning_used", name: "\u8D26\u53F7\u5B9A\u4F4D" },
  { key: "freeChat", column: "free_chat_used", name: "\u81EA\u7531\u5BF9\u8BDD" },
  { key: "storyboard", column: "storyboard_used", name: "\u5206\u955C\u811A\u672C" },
  { key: "review", column: "review_used", name: "\u5BA1\u7A3F\u4F18\u5316" },
  { key: "title", column: "title_used", name: "\u6807\u9898\u5C01\u9762" },
  { key: "dealReason", column: "deal_reason_used", name: "\u6210\u4EA4\u7406\u7531" },
  // 前采建档：user_quotas.interview_used 由 20260929_interview_import.sql 加
  { key: "interview", column: "interview_used", name: "\u524D\u91C7\u5EFA\u6863" },
  // 拆解爆款：user_quotas.breakdown_used 由 20260930_breakdown.sql 加
  { key: "breakdown", column: "breakdown_used", name: "\u62C6\u89E3\u7206\u6B3E" },
  // 跨行业二创：user_quotas.remix_used 由 20260930_remix.sql 加
  { key: "remix", column: "remix_used", name: "\u8DE8\u884C\u4E1A\u4E8C\u521B" },
  // 创作方向：user_quotas.direction_used 由 20261002_direction.sql 加
  { key: "direction", column: "direction_used", name: "\u521B\u4F5C\u65B9\u5411" },
  { key: "knowledge", column: "knowledge_used", name: "\u77E5\u8BC6\u5E93\u67E5\u8BE2" }
];
var FEATURE_NAMES = Object.fromEntries(
  COUNTED_FEATURES.map((f) => [f.key, f.name])
);

// .tmp/content-audit-production_20261008/lib/creation-quota.ts
function completionUsage(event) {
  if (!event || typeof event !== "object") return {};
  const e = event;
  const usage = e.metadata?.usage || e.data?.usage || {};
  const out = {};
  for (const key of ["prompt_tokens", "completion_tokens", "total_tokens", "latency", "total_price"]) {
    const raw = usage[key];
    if ((typeof raw === "number" || typeof raw === "string" && raw.trim() !== "") && Number.isFinite(Number(raw)) && Number(raw) >= 0) out[key] = Number(raw);
  }
  if (typeof usage.currency === "string" && /^[A-Za-z]{3}$/.test(usage.currency)) out.currency = usage.currency;
  for (const key of ["total_tokens", "elapsed_time"]) {
    const value = e.data?.[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) out[key] = value;
  }
  return out;
}

// .tmp/content-audit-production_20261008/lib/chat-attachments.ts
var MAX_CHAT_FILE_BYTES = 10 * 1024 * 1024;
var CHAT_FILE_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.pdf,.docx,.xlsx,.csv,.pptx,.txt,.md,.html,.xml";
var CHAT_FILE_EXTENSIONS = new Set(CHAT_FILE_ACCEPT.split(",").map((x) => x.slice(1)));

// .tmp/content-audit-production_20261008/lib/chat-attachments-server.ts
function toDifyFiles(files) {
  return files.map((file) => ({ type: file.type, transfer_method: "local_file", upload_file_id: file.id }));
}

// .tmp/content-audit-production_20261008/lib/dify-task.ts
var DIFY_BASE_URL = process.env.DIFY_BASE_URL || "https://api.dify.ai/v1";
async function askDify(query, userId, searchQuery, options = {}) {
  const res = await fetch(`${DIFY_BASE_URL}/chat-messages`, {
    method: "POST",
    signal: options.signal,
    headers: { Authorization: `Bearer ${process.env.DIFY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      inputs: { query, search_query: searchQuery, conversation_history: "", dealReasons: "", web_search_enabled: "0", web_search_note: "\u672C\u8F6E\u4EC5\u6574\u7406\u548C\u6838\u5BF9\u7528\u6237\u63D0\u4F9B\u7684\u524D\u91C7\u8D44\u6599\uFF0C\u4E0D\u6267\u884C\u8054\u7F51\u641C\u7D22\u3002" },
      query,
      response_mode: "streaming",
      user: userId,
      ...options.files?.length ? { files: toDifyFiles(options.files) } : {}
    })
  });
  if (!res.ok || !res.body) {
    console.error("[dify-task] Dify \u8C03\u7528\u5931\u8D25:", res.status, (await res.text().catch(() => "")).slice(0, 200));
    return { ok: false, message: "AI \u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text3 = "";
  let terminal;
  let conversationId;
  let messageId;
  let usage = {};
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line2 of lines) {
      if (!line2.startsWith("data: ")) continue;
      let data;
      try {
        data = JSON.parse(line2.slice(6));
      } catch {
        continue;
      }
      const failure = difyEventError(data);
      if (failure) return { ok: false, message: friendlyDifyError(failure) };
      if (typeof data.conversation_id === "string") conversationId = data.conversation_id;
      if (typeof data.message_id === "string") messageId = data.message_id;
      if (data.event === "message_end" || data.event === "workflow_finished") {
        terminal = data.event;
        usage = { ...usage, ...completionUsage(data) };
      }
      const chunk = data.answer || data.text || "";
      if ((data.event === "message" || data.event === "text_chunk") && chunk) text3 += chunk;
    }
  }
  reader.releaseLock();
  if (!text3.trim()) return { ok: false, message: "\u8FD9\u6B21\u6CA1\u8BFB\u51FA\u7ED3\u679C\uFF0C\u8BF7\u91CD\u8BD5" };
  if (!terminal) return { ok: false, message: "\u56DE\u7B54\u6CA1\u6709\u5B8C\u6574\u7ED3\u675F\uFF0C\u8BF7\u91CD\u8BD5" };
  return { ok: true, text: text3, completion: { terminal, conversationId, messageId, usage } };
}

// .tmp/content-audit-production_20261008/lib/profile-options.ts
var SELLING_POINTS = [
  { value: "\u8D28\u91CF\u597D", hint: "\u7528\u6599\u8DB3\u3001\u8D27\u771F\u4EF7\u5B9E" },
  { value: "\u6548\u679C\u597D", hint: "\u505A\u5B8C\u6539\u53D8\u660E\u663E" },
  { value: "\u6027\u4EF7\u6BD4\u9AD8", hint: "\u540C\u7B49\u4EF7\u683C\u7ED9\u5F97\u66F4\u591A" },
  { value: "\u597D\u8BC4\u591A", hint: "\u56DE\u5934\u5BA2\u591A\u3001\u53E3\u7891\u597D" },
  { value: "\u4E13\u4E1A\u5F3A", hint: "\u6709\u8D44\u8D28\u3001\u6709\u5E74\u5934\u3001\u6280\u672F\u8FC7\u786C" },
  { value: "\u8001\u677F\u597D", hint: "\u672C\u4EBA\u70ED\u60C5\u3001\u9760\u8C31\u3001\u6709\u6545\u4E8B" },
  { value: "\u670D\u52A1\u597D", hint: "\u8D34\u5FC3\u3001\u552E\u540E\u7701\u5FC3" },
  { value: "\u5B9E\u5728\u4E0D\u5751", hint: "\u660E\u7801\u6807\u4EF7\u3001\u4E0D\u5BB0\u5BA2" },
  { value: "\u6709\u7279\u8272", hint: "\u522B\u5BB6\u6CA1\u6709\u7684\u505A\u6CD5\u6216\u54C1\u7C7B" },
  { value: "\u9009\u62E9\u591A", hint: "\u54C1\u7C7B\u5168\u3001\u6B3E\u5F0F\u591A" },
  { value: "\u751F\u610F\u597D", hint: "\u6392\u961F\u3001\u706B\u7206\u3001\u5E38\u6EE1\u5EA7" },
  { value: "\u89C4\u6A21\u5927", hint: "\u8FDE\u9501\u3001\u5206\u5E97\u591A\u3001\u573A\u5730\u5927" },
  { value: "\u6848\u4F8B\u591A", hint: "\u505A\u8FC7\u7684\u5355\u5B50\u591A\u3001\u6709\u636E\u53EF\u67E5" },
  { value: "\u4FBF\u5229\u6027", hint: "\u4F4D\u7F6E\u597D\u3001\u79BB\u5F97\u8FD1\u3001\u6765\u53BB\u65B9\u4FBF" },
  { value: "\u989C\u503C\u9AD8", hint: "\u73AF\u5883\u6216\u51FA\u54C1\u597D\u770B\u3001\u9002\u5408\u62CD\u7167" },
  { value: "\u7A00\u7F3A\u552F\u4E00", hint: "\u9650\u91CF\u3001\u72EC\u5BB6\u3001\u522B\u5904\u4E70\u4E0D\u5230" },
  { value: "\u6709\u9762\u5B50", hint: "\u6863\u6B21\u3001\u54C1\u5473\u3001\u8BF7\u5BA2\u4E0D\u4E22\u4EFD" }
];
var PAIN_POINTS = [
  { value: "\u6015\u88AB\u5BB0 / \u4EF7\u683C\u4E0D\u900F\u660E", hint: "\u4E0D\u77E5\u9053\u8BE5\u82B1\u591A\u5C11\u94B1\u624D\u5408\u7406" },
  { value: "\u6015\u8D28\u91CF\u6709\u95EE\u9898", hint: "\u62C5\u5FC3\u4EE5\u6B21\u5145\u597D\u3001\u8D27\u4E0D\u5BF9\u677F" },
  { value: "\u6015\u6548\u679C\u8FBE\u4E0D\u5230\u9884\u671F", hint: "\u82B1\u4E86\u94B1\u6CA1\u7528" },
  { value: "\u4E0D\u77E5\u9053\u600E\u4E48\u6311 / \u5206\u8FA8\u4E0D\u51FA\u597D\u574F", hint: "\u7F3A\u5224\u65AD\u6807\u51C6" },
  { value: "\u88AB\u540C\u884C\u5751\u8FC7 / \u6709\u9634\u5F71", hint: "\u8E29\u8FC7\u5751\u6240\u4EE5\u8C28\u614E" },
  { value: "\u9009\u62E9\u592A\u591A / \u6311\u82B1\u773C", hint: "\u540C\u7C7B\u592A\u591A\u4E0D\u77E5\u9053\u9009\u8C01" },
  { value: "\u6015\u670D\u52A1\u6001\u5EA6\u5DEE", hint: "\u62C5\u5FC3\u88AB\u6577\u884D\u3001\u88AB\u51B7\u843D" },
  { value: "\u6015\u9EBB\u70E6 / \u6D41\u7A0B\u590D\u6742", hint: "\u4E0D\u60F3\u6298\u817E" },
  { value: "\u6015\u552E\u540E\u6CA1\u4EBA\u7BA1", hint: "\u51FA\u4E86\u95EE\u9898\u627E\u4E0D\u5230\u4EBA" },
  { value: "\u9884\u7B97\u6709\u9650\u4F46\u8981\u6C42\u4E0D\u4F4E", hint: "\u60F3\u82B1\u5C0F\u94B1\u529E\u597D\u4E8B" },
  { value: "\u65F6\u95F4\u7D27 / \u7B49\u4E0D\u8D77", hint: "\u9700\u8981\u5FEB" },
  { value: "\u4E0D\u597D\u610F\u601D\u95EE / \u6015\u663E\u5F97\u5916\u884C", hint: "\u6709\u987E\u8651\u4F46\u4E0D\u6562\u5F00\u53E3" }
];
var USER_NEEDS = [
  { value: "\u8981\u771F\u6750\u5B9E\u6599", hint: "\u770B\u5F97\u89C1\u7684\u5B9E\u5728" },
  { value: "\u8981\u660E\u786E\u7684\u6548\u679C", hint: "\u505A\u5B8C\u80FD\u770B\u5230\u53D8\u5316" },
  { value: "\u8981\u6709\u4EBA\u5E2E\u7740\u6311", hint: "\u5E0C\u671B\u6709\u61C2\u884C\u7684\u7ED9\u5EFA\u8BAE" },
  { value: "\u8981\u7701\u5FC3\u7701\u4E8B", hint: "\u4E00\u7AD9\u89E3\u51B3\u4E0D\u6298\u817E" },
  { value: "\u8981\u4EF7\u683C\u900F\u660E", hint: "\u4E8B\u5148\u77E5\u9053\u82B1\u591A\u5C11" },
  { value: "\u8981\u5FEB", hint: "\u65F6\u95F4\u5C31\u662F\u6210\u672C" },
  { value: "\u8981\u6709\u9762\u5B50", hint: "\u62FF\u5F97\u51FA\u624B\u3001\u80FD\u6652" },
  { value: "\u8981\u957F\u671F\u6709\u4EBA\u7BA1", hint: "\u552E\u540E\u548C\u56DE\u8BBF" }
];
var CONTENT_VALUE = [
  { value: "\u8BA9\u4EBA\u957F\u89C1\u8BC6\uFF08\u8BA4\u77E5\u53D8\u5316\uFF09", hint: "\u539F\u6765\u5982\u6B64\u3001\u6DA8\u77E5\u8BC6 \u2192 \u6536\u85CF\u5173\u6CE8" },
  { value: "\u8BA9\u4EBA\u6709\u60C5\u7EEA\uFF08\u60C5\u7EEA\u53D8\u5316\uFF09", hint: "\u723D\u3001\u7B11\u3001\u611F\u52A8\u3001\u6C14\u6124 \u2192 \u8BC4\u8BBA\u8F6C\u53D1" },
  { value: "\u8BA9\u4EBA\u80FD\u7167\u505A\uFF08\u884C\u52A8\u53D8\u5316\uFF09", hint: "\u6211\u73B0\u5728\u5C31\u80FD\u8BD5 \u2192 \u4FDD\u5B58\u5C1D\u8BD5" },
  { value: "\u8BA9\u4EBA\u5BF9\u53F7\u5165\u5EA7\uFF08\u8EAB\u4EFD\u786E\u8BA4\uFF09", hint: "\u8FD9\u8BF4\u7684\u4E0D\u5C31\u662F\u6211 \u2192 \u4E92\u52A8\u5173\u6CE8" },
  { value: "\u8BA9\u4EBA\u4EA7\u751F\u4FE1\u4EFB\uFF08\u4FE1\u4EFB\u53D8\u5316\uFF09", hint: "\u8FD9\u4EBA\u61C2\u884C\u4E14\u505A\u5F97\u5230 \u2192 \u54A8\u8BE2\u8D2D\u4E70" }
];
var FAN_QUESTIONS = [
  { value: "\u591A\u5C11\u94B1 / \u600E\u4E48\u6536\u8D39", hint: "\u4EF7\u683C\u7C7B" },
  { value: "\u771F\u7684\u5047\u7684 / \u662F\u4E0D\u662F\u771F\u6750\u5B9E\u6599", hint: "\u771F\u4F2A\u8D28\u7591\u7C7B" },
  { value: "\u6548\u679C\u80FD\u4FDD\u6301\u591A\u4E45", hint: "\u6548\u679C\u7C7B" },
  { value: "\u9002\u4E0D\u9002\u5408\u6211\u8FD9\u79CD\u60C5\u51B5", hint: "\u9002\u914D\u7C7B" },
  { value: "\u5728\u54EA\u91CC / \u600E\u4E48\u53BB / \u8425\u4E1A\u65F6\u95F4", hint: "\u5230\u5E97\u7C7B" },
  { value: "\u8981\u7B49\u591A\u4E45 / \u8981\u4E0D\u8981\u9884\u7EA6", hint: "\u6D41\u7A0B\u7C7B" },
  { value: "\u548C\u67D0\u67D0\u5BB6\u6BD4\u600E\u4E48\u6837", hint: "\u6BD4\u4EF7\u7C7B" },
  { value: "\u81EA\u5DF1\u5728\u5BB6\u80FD\u4E0D\u80FD\u505A", hint: "\u66FF\u4EE3\u65B9\u6848\u7C7B" },
  { value: "\u51FA\u95EE\u9898\u4E86\u600E\u4E48\u529E", hint: "\u552E\u540E\u7C7B" }
];
var CONVERSION_BARRIERS = [
  { value: "\u89C9\u5F97\u8D35 / \u8D85\u9884\u7B97", hint: "\u4EF7\u683C\u95E8\u69DB" },
  { value: "\u4E0D\u76F8\u4FE1\u662F\u771F\u7684", hint: "\u4FE1\u4EFB\u95E8\u69DB" },
  { value: "\u4E0D\u7740\u6025 / \u518D\u770B\u770B", hint: "\u9700\u6C42\u4E0D\u8FEB\u5207" },
  { value: "\u6015\u8E29\u5751 / \u60F3\u5148\u89C2\u671B", hint: "\u98CE\u9669\u987E\u8651" },
  { value: "\u8DDD\u79BB\u8FDC / \u6765\u4E00\u8D9F\u9EBB\u70E6", hint: "\u4FBF\u5229\u6027\u95E8\u69DB" },
  { value: "\u4E0D\u77E5\u9053\u6548\u679C\u597D\u4E0D\u597D", hint: "\u7F3A\u8BC1\u636E" },
  { value: "\u8981\u548C\u5BB6\u4EBA\u5546\u91CF", hint: "\u51B3\u7B56\u94FE\u957F" },
  { value: "\u540C\u884C\u5728\u6253\u4EF7\u683C\u6218", hint: "\u5916\u90E8\u7ADE\u4E89" }
];
var CONVERSION_PATHS = [
  { value: "\u770B\u89C6\u9891 \u2192 \u8BC4\u8BBA\u533A\u95EE \u2192 \u79C1\u4FE1 \u2192 \u5230\u5E97", hint: "\u672C\u5730\u751F\u610F\u6700\u5E38\u89C1" },
  { value: "\u770B\u89C6\u9891 \u2192 \u70B9\u4E3B\u9875 \u2192 \u52A0\u5FAE\u4FE1 \u2192 \u6210\u4EA4", hint: "\u9700\u8981\u6C9F\u901A\u7684\u670D\u52A1" },
  { value: "\u770B\u89C6\u9891 \u2192 \u56E2\u8D2D\u94FE\u63A5\u4E0B\u5355 \u2192 \u5230\u5E97\u6838\u9500", hint: "\u6807\u51C6\u5316\u5957\u9910" },
  { value: "\u770B\u89C6\u9891 \u2192 \u8FDB\u76F4\u64AD\u95F4 \u2192 \u4E0B\u5355", hint: "\u6709\u76F4\u64AD\u80FD\u529B" },
  { value: "\u770B\u89C6\u9891 \u2192 \u5C0F\u7A0B\u5E8F/\u5546\u57CE\u4E0B\u5355 \u2192 \u53D1\u8D27", hint: "\u5B9E\u7269\u7535\u5546" },
  { value: "\u770B\u89C6\u9891 \u2192 \u7535\u8BDD\u54A8\u8BE2 \u2192 \u4E0A\u95E8/\u5230\u5E97", hint: "\u9AD8\u5BA2\u5355\u670D\u52A1" }
];
var RESTRICTIONS = [
  { value: "\u7EDD\u5BF9\u5316\u7528\u8BED\uFF08\u6700\u597D / \u7B2C\u4E00 / \u5168\u7F51\u6700\u4FBF\u5B9C\uFF09", hint: "\u5E7F\u544A\u6CD5\u7EA2\u7EBF\uFF0C\u5EFA\u8BAE\u90FD\u52FE\u4E0A" },
  { value: "\u4E0D\u80FD\u627F\u8BFA\u7597\u6548\u6216\u6548\u679C", hint: "\u533B\u7F8E\u3001\u5065\u5EB7\u3001\u6559\u80B2\u7C7B\u5C24\u5176\u8981\u6CE8\u610F" },
  { value: "\u4E0D\u80FD\u63D0\u7ADE\u4E89\u5BF9\u624B\u540D\u5B57", hint: "\u907F\u514D\u7EA0\u7EB7" },
  { value: "\u4E0D\u80FD\u51FA\u73B0\u5177\u4F53\u4EF7\u683C\u6570\u5B57", hint: "\u4EF7\u683C\u5E38\u53D8\u6216\u5E73\u53F0\u9650\u6D41\u65F6" },
  { value: "\u4E0D\u80FD\u900F\u9732\u4F9B\u5E94\u5546 / \u8FDB\u8D27\u6E20\u9053", hint: "\u5546\u4E1A\u673A\u5BC6" },
  { value: "\u4E0D\u80FD\u62CD\u5230\u987E\u5BA2\u6B63\u8138", hint: "\u9690\u79C1\u987E\u8651" },
  { value: '\u4E0D\u80FD\u7528"\u63ED\u79D8"\u4E8C\u5B57', hint: "\u5BB9\u6613\u62DB\u540C\u884C\u4E3E\u62A5" },
  { value: "\u4E0D\u78B0\u65F6\u653F / \u5B97\u6559 / \u5730\u57DF\u4E89\u8BAE", hint: "\u901A\u7528\u7EA2\u7EBF" }
];
var RESOURCES = [
  { value: "\u81EA\u6709\u95E8\u5E97 / \u573A\u5730", hint: "\u80FD\u5F53\u62CD\u6444\u73B0\u573A" },
  { value: "\u7A33\u5B9A\u7684\u4F9B\u5E94\u94FE\u6216\u8D27\u6E90", hint: "\u80FD\u62CD\u8FDB\u8D27\u3001\u6EAF\u6E90" },
  { value: "\u8001\u5BA2\u6237\u613F\u610F\u51FA\u955C", hint: "\u771F\u5B9E\u6848\u4F8B\u7D20\u6750" },
  { value: "\u540C\u884C\u4EBA\u8109 / \u884C\u4E1A\u8D44\u6E90", hint: "\u80FD\u505A\u8054\u52A8\u548C\u5185\u5E55" },
  { value: "\u6709\u8D44\u8D28\u8BC1\u4E66 / \u83B7\u5956", hint: "\u4E13\u4E1A\u80CC\u4E66" },
  { value: "\u505A\u4E86\u5F88\u591A\u5E74 / \u6709\u79EF\u7D2F", hint: "\u6545\u4E8B\u548C\u6848\u4F8B\u591A" },
  { value: "\u6709\u4F1A\u62CD\u4F1A\u526A\u7684\u4EBA", hint: "\u751F\u4EA7\u80FD\u529B" },
  { value: "\u6709\u5458\u5DE5/\u5BB6\u4EBA\u80FD\u914D\u5408\u51FA\u955C", hint: "\u80FD\u505A\u5173\u7CFB\u7C7B\u3001\u5267\u60C5\u7C7B" }
];
var WEAKNESSES = [
  { value: "\u4E0D\u4F1A\u8BB2 / \u955C\u5934\u524D\u7D27\u5F20", hint: "\u53E3\u64AD\u7C7B\u8981\u8C28\u614E" },
  { value: "\u6CA1\u65F6\u95F4 / \u53EA\u80FD\u6324\u7A7A\u6863\u62CD", hint: "\u4EA7\u80FD\u53D7\u9650" },
  { value: "\u4F4D\u7F6E\u504F / \u4E0D\u597D\u627E", hint: "\u8981\u9760\u5185\u5BB9\u8865\u4FBF\u5229\u6027" },
  { value: "\u4EF7\u683C\u6BD4\u540C\u884C\u9AD8", hint: "\u5FC5\u987B\u8BB2\u6E05\u51ED\u4EC0\u4E48\u8D35" },
  { value: "\u521A\u5F00\u4E0D\u4E45 / \u6CA1\u4EC0\u4E48\u6848\u4F8B", hint: "\u5148\u6512\u8FC7\u7A0B\u548C\u8BC1\u636E" },
  { value: "\u5E97\u9762\u5C0F / \u73AF\u5883\u4E00\u822C", hint: "\u907F\u5F00\u5168\u666F\uFF0C\u591A\u7528\u7279\u5199" },
  { value: "\u540C\u884C\u592A\u591A / \u7ADE\u4E89\u6FC0\u70C8", hint: "\u5FC5\u987B\u505A\u5DEE\u5F02\u5316" },
  { value: "\u4E0D\u61C2\u5E73\u53F0\u89C4\u5219\u548C\u73A9\u6CD5", hint: "\u9700\u8981\u5148\u8DD1\u901A\u57FA\u7840" }
];
var BEST_PERFORMING = [
  { value: "\u8FD8\u6CA1\u53D1\u8FC7 / \u8FD8\u770B\u4E0D\u51FA\u6765", hint: "\u65B0\u53F7\u9009\u8FD9\u4E2A\u5C31\u884C" },
  { value: "\u8BB2\u77E5\u8BC6 / \u6559\u65B9\u6CD5\u7684", hint: "" },
  { value: "\u62CD\u5DE5\u4F5C\u8FC7\u7A0B\u7684", hint: "" },
  { value: "\u8BB2\u89C2\u70B9 / \u5410\u69FD\u7684", hint: "" },
  { value: "\u8BB2\u6545\u4E8B / \u8BB2\u7ECF\u5386\u7684", hint: "" },
  { value: "\u63A2\u5E97 / \u5E26\u770B\u73AF\u5883\u7684", hint: "" },
  { value: "\u5BF9\u6BD4\u6D4B\u8BC4\u7C7B", hint: "" },
  { value: "\u641E\u7B11 / \u6BB5\u5B50\u7C7B", hint: "" },
  { value: "\u987E\u5BA2\u771F\u5B9E\u53CD\u9988\u7C7B", hint: "" }
];
var OPTION_GROUPS = [
  {
    field: "target_pain_points",
    label: "\u4F60\u7684\u5BA2\u4EBA\u6700\u62C5\u5FC3\u4EC0\u4E48",
    why: "\u8FD9\u662F\u5185\u5BB9\u6700\u597D\u7528\u7684\u5207\u5165\u70B9\u2014\u2014\u5199\u811A\u672C\u3001\u8D77\u6807\u9898\u3001\u60F3\u9009\u9898\u90FD\u4ECE\u8FD9\u91CC\u6765",
    options: PAIN_POINTS,
    allowOther: true,
    maxHint: 4
  },
  {
    field: "target_needs",
    label: "\u4ED6\u4EEC\u771F\u6B63\u60F3\u8981\u4EC0\u4E48",
    why: '\u75DB\u70B9\u662F"\u6015\u4EC0\u4E48"\uFF0C\u9700\u6C42\u662F"\u8981\u4EC0\u4E48"\uFF0C\u4E24\u4E2A\u90FD\u6709\u5185\u5BB9\u624D\u6709\u6B63\u53CD\u4E24\u9762',
    options: USER_NEEDS,
    allowOther: true,
    maxHint: 3
  },
  {
    field: "unique_selling_point",
    label: "\u4F60\u51ED\u4EC0\u4E48\u8BA9\u4EBA\u9009\u4F60",
    why: "\u8FD9\u51B3\u5B9A\u4E86\u89C6\u9891\u91CC\u8981\u53CD\u590D\u8BC1\u660E\u4EC0\u4E48\u3002\u52FE\u592A\u591A\u7B49\u4E8E\u6CA1\u91CD\u70B9\uFF0C\u6311\u6700\u786C\u7684 2-3 \u4E2A",
    options: SELLING_POINTS,
    allowOther: true,
    maxHint: 3
  },
  {
    field: "content_value",
    label: "\u4F60\u60F3\u8BA9\u89C2\u4F17\u770B\u5B8C\u6709\u4EC0\u4E48\u53D8\u5316",
    why: '\u53EA\u6709"\u4EA7\u751F\u4FE1\u4EFB"\u8FD9\u4E00\u9879\u76F4\u63A5\u5E26\u6765\u6210\u4EA4\uFF0C\u5176\u4F59\u662F\u6DA8\u7C89\u548C\u4F20\u64AD',
    options: CONTENT_VALUE,
    allowOther: false,
    maxHint: 2
  },
  {
    field: "fan_common_questions",
    label: "\u5BA2\u4EBA\u6700\u5E38\u95EE\u4F60\u4EC0\u4E48",
    why: "\u6BCF\u4E00\u4E2A\u9AD8\u9891\u95EE\u9898\u90FD\u662F\u4E00\u6761\u73B0\u6210\u7684\u9009\u9898\uFF0C\u8FD9\u4E00\u680F\u586B\u4E86\u9009\u9898\u5C31\u4E0D\u6101",
    options: FAN_QUESTIONS,
    allowOther: true
  },
  {
    field: "conversion_barriers",
    label: "\u4ED6\u4EEC\u4E3A\u4EC0\u4E48\u72B9\u8C6B\u3001\u6CA1\u4E0B\u5355",
    why: "\u5185\u5BB9\u8981\u4E00\u6761\u6761\u628A\u8FD9\u4E9B\u987E\u8651\u62C6\u6389\uFF0C\u4E0D\u7136\u6D41\u91CF\u518D\u5927\u4E5F\u4E0D\u6210\u4EA4",
    options: CONVERSION_BARRIERS,
    allowOther: true,
    maxHint: 3
  },
  {
    field: "conversion_path",
    label: "\u5BA2\u4EBA\u4E00\u822C\u600E\u4E48\u627E\u5230\u4F60\u3001\u600E\u4E48\u6210\u4EA4",
    why: "\u51B3\u5B9A\u89C6\u9891\u7ED3\u5C3E\u628A\u4EBA\u5F80\u54EA\u513F\u5F15",
    options: CONVERSION_PATHS,
    allowOther: true,
    maxHint: 2
  },
  {
    field: "content_restrictions",
    label: "\u7EDD\u5BF9\u4E0D\u80FD\u8BF4\u7684\u8BDD",
    why: "\u786C\u7EA6\u675F\u3002\u52FE\u4E0A\u4E4B\u540E\u6240\u6709\u4EA7\u51FA\u90FD\u4F1A\u907F\u5F00\uFF0C\u6F0F\u6389\u53EF\u80FD\u76F4\u63A5\u8FDD\u89C4",
    options: RESTRICTIONS,
    allowOther: true
  },
  {
    field: "unique_resources",
    label: "\u4F60\u624B\u4E0A\u6709\u4EC0\u4E48\u522B\u4EBA\u6CA1\u6709\u7684",
    why: "\u8FD9\u4E9B\u662F\u80FD\u62CD\u3001\u80FD\u5F53\u8BC1\u636E\u7684\u4E1C\u897F\uFF0C\u51B3\u5B9A\u4E86\u5185\u5BB9\u80FD\u505A\u591A\u6DF1",
    options: RESOURCES,
    allowOther: true
  },
  {
    field: "competitive_weakness",
    label: "\u73B0\u5728\u6700\u5927\u7684\u77ED\u677F",
    why: "\u8BF4\u5B9E\u8BDD\u53CD\u800C\u6709\u7528\u2014\u2014AI \u4F1A\u7ED5\u5F00\u4F60\u505A\u4E0D\u5230\u7684\uFF0C\u4E0D\u7ED9\u4F60\u62CD\u4E0D\u51FA\u6765\u7684\u65B9\u6848",
    options: WEAKNESSES,
    allowOther: true,
    maxHint: 3
  },
  {
    field: "viral_content_pattern",
    label: "\u5DF2\u7ECF\u53D1\u8FC7\u7684\u5185\u5BB9\u91CC\uFF0C\u54EA\u7C7B\u6570\u636E\u6700\u597D",
    why: "\u6709\u9A8C\u8BC1\u8FC7\u7684\u65B9\u5411\u5C31\u987A\u7740\u505A\uFF0C\u522B\u63A8\u5012\u91CD\u6765",
    options: BEST_PERFORMING,
    allowOther: true,
    maxHint: 2
  }
];

// .tmp/content-audit-production_20261008/lib/profile-fields.ts
var PROFILE_CHOICES = {
  account_platform: ["\u6296\u97F3", "\u5FEB\u624B", "\u89C6\u9891\u53F7", "\u5C0F\u7EA2\u4E66", "B\u7AD9"],
  account_track: ["\u7F8E\u98DF\u70F9\u996A", "\u65F6\u5C1A\u7A7F\u642D", "\u7F8E\u5986\u62A4\u80A4", "\u5065\u8EAB\u8FD0\u52A8", "\u77E5\u8BC6\u6559\u80B2", "\u804C\u573A\u6210\u957F", "\u60C5\u611F\u751F\u6D3B", "\u65C5\u6E38\u63A2\u5E97", "\u5BB6\u5C45\u88C5\u4FEE", "\u6BCD\u5A74\u80B2\u513F", "\u6570\u7801\u79D1\u6280", "\u672C\u5730\u670D\u52A1"],
  account_stage: ["\u521A\u8D77\u53F7\uFF0C\u5B9A\u4F4D\u672A\u786E\u5B9A", "\u6709\u5B9A\u4F4D\uFF0C\u9700\u8981\u5185\u5BB9\u65B9\u5411", "\u7A33\u5B9A\u8FD0\u8425\uFF0C\u9700\u8981\u65B0\u9009\u9898", "\u6210\u719F\u671F\uFF0C\u9700\u8981\u7A81\u7834"],
  fans_level: ["0-1\u4E07", "1-5\u4E07", "5-10\u4E07", "10-50\u4E07", "50\u4E07+"],
  target_gender: ["\u7537\u6027\u4E3A\u4E3B", "\u5973\u6027\u4E3A\u4E3B", "\u4E0D\u9650"],
  target_age: ["18-24\u5C81", "25-30\u5C81", "31-40\u5C81", "41\u5C81\u4EE5\u4E0A"],
  target_region: ["\u4E00\u4E8C\u7EBF\u57CE\u5E02", "\u4E09\u56DB\u7EBF\u57CE\u5E02", "\u5168\u56FD", "\u672C\u5730\u540C\u57CE"],
  target_occupation: ["\u767D\u9886", "\u5B66\u751F", "\u5B9D\u5988", "\u81EA\u7531\u804C\u4E1A", "\u4F01\u4E1A\u4E3B", "\u84DD\u9886\u6280\u5DE5"],
  content_style: ["\u4E13\u4E1A", "\u8F7B\u677E", "\u5E7D\u9ED8", "\u60C5\u611F", "\u52B1\u5FD7", "\u5B9E\u7528", "\u9AD8\u7EA7", "\u63A5\u5730\u6C14"],
  content_format: ["\u53E3\u64AD", "\u5267\u60C5", "\u6559\u7A0B", "Vlog", "\u6D4B\u8BC4", "\u91C7\u8BBF", "\u6DF7\u526A", "\u56FE\u6587"],
  content_tone: ["\u4EB2\u5207\u670B\u53CB\u5F0F", "\u4E13\u4E1A\u6743\u5A01\u5F0F", "\u5E7D\u9ED8\u641E\u7B11\u5F0F", "\u6E29\u6696\u6CBB\u6108\u5F0F", "\u76F4\u7387\u7280\u5229\u5F0F"],
  team_structure: ["\u4E00\u4EBA\u5168\u5305", "2-3\u4EBA\u5C0F\u56E2\u961F", "\u5B8C\u6574\u56E2\u961F(\u7F16\u5BFC/\u6444\u5F71/\u526A\u8F91)", "\u4E13\u4E1AMCN"],
  equipment: ["\u624B\u673A", "\u76F8\u673A", "\u4E13\u4E1A\u6444\u50CF\u673A", "\u706F\u5149", "\u6536\u97F3\u8BBE\u5907", "\u7A33\u5B9A\u5668"],
  shooting_location: ["\u5BB6", "\u5DE5\u4F5C\u5BA4", "\u5916\u666F", "\u5E97\u94FA", "\u529E\u516C\u5BA4"],
  editing_capability: ["\u57FA\u7840\u526A\u8F91", "\u4E2D\u7EA7\u7279\u6548", "\u4E13\u4E1A\u5236\u4F5C"],
  video_duration: ["15-30\u79D2", "30-60\u79D2", "1-3\u5206\u949F", "3-5\u5206\u949F", "5\u5206\u949F\u4EE5\u4E0A"],
  budget_per_video: ["0-500\u5143", "500-2000\u5143", "2000-5000\u5143", "5000\u5143\u4EE5\u4E0A"],
  monetization_model: ["\u5230\u5E97\u6D88\u8D39", "\u5E26\u8D27\u4F63\u91D1", "\u77E5\u8BC6\u4ED8\u8D39", "\u79C1\u57DF\u5F15\u6D41", "\u76F4\u64AD\u6253\u8D4F", "\u54C1\u724C\u5408\u4F5C", "\u7EBF\u4E0B\u670D\u52A1", "\u6682\u4E0D\u8003\u8651"],
  product_category: ["\u9910\u996E", "\u7F8E\u5986\u62A4\u80A4", "\u670D\u88C5\u914D\u9970", "\u751F\u6D3B\u7528\u54C1", "\u98DF\u54C1\u996E\u6599", "\u6570\u7801\u5BB6\u7535", "\u672C\u5730\u670D\u52A1"],
  price_range: ["50\u5143\u4EE5\u4E0B", "50-200\u5143", "200-500\u5143", "500\u5143\u4EE5\u4E0A"]
};
var pickField = (key) => {
  const g = OPTION_GROUPS.find((x) => x.field === key);
  if (!g) throw new Error(`profile-options \u91CC\u6CA1\u6709 ${key}`);
  return { key, label: g.label, kind: "pick", options: g.options.map((o) => o.value), allowOther: g.allowOther !== false };
};
var multi = (key, label) => ({ key, label, kind: "multi", options: PROFILE_CHOICES[key] });
var single = (key, label) => ({ key, label, kind: "single", options: PROFILE_CHOICES[key] });
var text = (key, label) => ({ key, label, kind: "text" });
var PROFILE_SECTIONS = [
  {
    title: "\u8D26\u53F7\u57FA\u7840",
    fields: [
      multi("account_platform", "\u8FD0\u8425\u5E73\u53F0"),
      multi("account_track", "\u5185\u5BB9\u8D5B\u9053"),
      single("account_stage", "\u8D26\u53F7\u9636\u6BB5"),
      single("fans_level", "\u7C89\u4E1D\u91CF\u7EA7")
    ]
  },
  {
    title: "\u76EE\u6807\u53D7\u4F17",
    fields: [
      single("target_gender", "\u4E3B\u8981\u6027\u522B"),
      multi("target_age", "\u5E74\u9F84\u6BB5"),
      multi("target_region", "\u5730\u57DF\u5206\u5E03"),
      multi("target_occupation", "\u804C\u4E1A\u6807\u7B7E"),
      { key: "target_interests", label: "\u76EE\u6807\u4EBA\u7FA4\u7684\u5174\u8DA3", kind: "multi" },
      pickField("target_pain_points"),
      pickField("target_needs"),
      pickField("fan_common_questions")
    ]
  },
  {
    title: "\u5185\u5BB9\u5B9A\u4F4D",
    fields: [
      multi("content_style", "\u5185\u5BB9\u98CE\u683C"),
      multi("content_format", "\u5185\u5BB9\u5F62\u5F0F"),
      single("content_tone", "\u8BED\u8A00\u98CE\u683C"),
      text("content_themes", "\u4E3B\u8981\u9009\u9898\u65B9\u5411"),
      pickField("content_value"),
      pickField("unique_selling_point"),
      pickField("viral_content_pattern"),
      pickField("content_restrictions")
    ]
  },
  {
    title: "\u7ADE\u4E89\u7B56\u7565",
    fields: [
      text("reference_accounts", "\u5BF9\u6807\u8D26\u53F7"),
      text("competitive_advantage", "\u7ADE\u4E89\u4F18\u52BF"),
      pickField("competitive_weakness"),
      pickField("unique_resources")
    ]
  },
  {
    title: "\u8D44\u6E90\u914D\u7F6E",
    fields: [
      single("team_structure", "\u56E2\u961F\u914D\u7F6E"),
      multi("equipment", "\u8BBE\u5907\u6761\u4EF6"),
      multi("shooting_location", "\u62CD\u6444\u573A\u5730"),
      single("editing_capability", "\u540E\u671F\u80FD\u529B"),
      multi("video_duration", "\u89C6\u9891\u65F6\u957F\u504F\u597D"),
      single("budget_per_video", "\u5355\u6761\u9884\u7B97")
    ]
  },
  {
    title: "\u53D8\u73B0\u8DEF\u5F84",
    fields: [
      multi("monetization_model", "\u53D8\u73B0\u65B9\u5F0F"),
      multi("product_category", "\u4EA7\u54C1\u54C1\u7C7B"),
      multi("price_range", "\u4EF7\u683C\u533A\u95F4"),
      pickField("conversion_path"),
      pickField("conversion_barriers")
    ]
  }
];
var PROFILE_FIELDS = PROFILE_SECTIONS.flatMap((s) => s.fields);

// .tmp/content-audit-production_20261008/lib/interview-import.ts
var SPEC = new Map(PROFILE_FIELDS.map((f) => [f.key, f]));
var SENSITIVE = [
  /(?<!\d)1[3-9]\d{9}(?!\d)/g,
  /(?<!\d)\d{3,4}-\d{7,8}(?!\d)/g,
  /(?<!\d)\d{17}[\dXx](?!\d)/g,
  /(?<!\d)\d{16,19}(?!\d)/g
];
function scrubSensitive(s) {
  return SENSITIVE.reduce((t, re) => t.replace(re, "\uFF08\u5DF2\u9690\u53BB\uFF09"), s);
}
function extractJson(raw) {
  const s = raw.replace(/```(?:json)?/gi, "");
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("\u56DE\u590D\u91CC\u6CA1\u6709 JSON");
  const body = s.slice(a, b + 1);
  try {
    return JSON.parse(body);
  } catch {
    return JSON.parse(repairInnerQuotes(body));
  }
}
function repairInnerQuotes(s) {
  let out = "";
  let inStr = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr && c === "\\") {
      out += c + (s[i + 1] ?? "");
      i++;
      continue;
    }
    if (c === '"') {
      if (!inStr) {
        inStr = true;
      } else {
        let j = i + 1;
        while (j < s.length && /\s/.test(s[j])) j++;
        if (j < s.length && !",}]:".includes(s[j])) {
          out += '\\"';
          continue;
        }
        inStr = false;
      }
    }
    out += c;
  }
  return out;
}
var clip = (s, n) => s.length > n ? s.slice(0, n) : s;
var norm = (s) => s.replace(/[\s，。、！？,.!?：:；;"“”'‘’（）()【】\[\]…—-]/g, "").toLowerCase();
function evidenceInSource(evidence, source) {
  const e = norm(evidence);
  if (e.length < 4) return false;
  const src = norm(source);
  if (src.includes(e)) return true;
  const half = Math.floor(e.length / 2);
  return half >= 4 && (src.includes(e.slice(0, half)) || src.includes(e.slice(half)));
}
function toStrings(v) {
  if (Array.isArray(v)) return v.flatMap(toStrings);
  if (typeof v === "string") return v.split(/[、,，;；·\n]/).map((x) => x.trim()).filter(Boolean);
  if (typeof v === "number") return [String(v)];
  return [];
}
function cleanValue(spec, v) {
  const parts = toStrings(v).map((x) => clip(scrubSensitive(x), 80));
  if (parts.length === 0) return null;
  const opts = spec.options ?? [];
  if (spec.kind === "single") {
    const whole = typeof v === "string" ? [v.trim(), ...parts] : parts;
    const hit = opts.find((o) => whole.some((p) => p === o)) ?? opts.find((o) => whole.some((p) => p.includes(o)));
    return hit ?? null;
  }
  if (spec.kind === "multi") {
    return Array.from(new Set(parts.map((p) => clip(p, 20)))).slice(0, 8);
  }
  if (spec.kind === "pick") {
    const kept = spec.allowOther ? parts : parts.filter((p) => opts.includes(p));
    const uniq = Array.from(new Set(kept)).slice(0, 8);
    return uniq.length ? uniq.join("\u3001") : null;
  }
  return clip(scrubSensitive(toStrings(v).join("\uFF0C")), 300) || null;
}
function parseExtraction(raw, source) {
  const data = extractJson(raw);
  const rawFields = data?.fields && typeof data.fields === "object" ? data.fields : {};
  const fields = [];
  for (const [key, entry] of Object.entries(rawFields)) {
    const spec = SPEC.get(key);
    if (!spec) continue;
    const obj = entry && typeof entry === "object" && !Array.isArray(entry) ? entry : { value: entry };
    const value = cleanValue(spec, obj.value);
    if (value == null) continue;
    const evidence = clip(scrubSensitive(typeof obj.evidence === "string" ? obj.evidence.trim() : ""), 120);
    fields.push({ key: spec.key, value, evidence, unverified: !evidenceInSource(evidence, source) });
  }
  const order = new Map(PROFILE_FIELDS.map((f, i) => [f.key, i]));
  fields.sort((a, b) => order.get(a.key) - order.get(b.key));
  const highlights = toStringList(data?.highlights).map((h) => clip(scrubSensitive(h), 150)).slice(0, 8);
  const filled = new Set(fields.map((f) => f.key));
  const missing = [];
  for (const m of Array.isArray(data?.missing) ? data.missing : []) {
    const key = m?.field;
    const question = m?.question;
    const spec = SPEC.get(key);
    if (!spec || filled.has(key) || typeof question !== "string" || !question.trim()) continue;
    if (missing.some((x) => x.key === key)) continue;
    missing.push({ key, label: spec.label, question: clip(question.trim(), 120) });
    if (missing.length >= 6) break;
  }
  const name = typeof data?.profile_name === "string" ? clip(scrubSensitive(data.profile_name.trim()), 30) : "";
  return { profileName: name, fields, highlights, missing };
}
function toStringList(v) {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string").map((x) => x.trim()).filter(Boolean);
  if (typeof v === "string") return v.split("\n").map((x) => x.replace(/^[-•\d.、\s]+/, "").trim()).filter(Boolean);
  return [];
}
function buildCheckPrompt(ex, source) {
  const rows = ex.fields.map((f) => {
    const spec = SPEC.get(f.key);
    const opts = spec.options?.length ? `\uFF08${spec.kind === "single" ? "\u5355\u9009" : "\u6807\u51C6\u8BF4\u6CD5"}\uFF1A${spec.options.join(" / ")}\uFF09` : "";
    return `- ${f.key}\uFF08${spec.label}\uFF09${opts}\uFF1A${Array.isArray(f.value) ? f.value.join("\u3001") : f.value}
  \u4F9D\u636E\uFF1A${f.evidence || "\uFF08\u6CA1\u7ED9\uFF09"}`;
  }).join("\n");
  return `\u3010\u4EFB\u52A1\uFF1A\u524D\u91C7\u5EFA\u6863\xB7\u9010\u9879\u6838\u5BF9\u3011\u8FD9\u4E00\u6B21\u4E0D\u5199\u6587\u6848\u3001\u4E0D\u505A\u5206\u6790\uFF0C\u53EA\u6838\u5BF9\u3002

\u4E0B\u9762\u662F\u4ECE\u4E00\u4EFD\u524D\u91C7\u8BB0\u5F55\u91CC\u63D0\u53D6\u51FA\u6765\u7684\u8D26\u53F7\u6863\u6848\u3002\u4F60\u662F\u4E00\u4E2A\u4E25\u683C\u7684\u6838\u5BF9\u5458\uFF1A\u9010\u9879\u5BF9\u7167\u539F\u6587\uFF0C\u5224\u65AD\u6BCF\u4E00\u9879\u63D0\u53D6\u5F97\u5BF9\u4E0D\u5BF9\u3002

## \u6838\u5BF9\u6807\u51C6
- **\u6CA1\u95EE\u9898**\uFF1A\u539F\u6587\u660E\u786E\u8BF4\u5230\uFF0C\u503C\u548C\u539F\u6587\u4E00\u81F4\u3002
- \u4EE5\u4E0B\u90FD\u7B97**\u6709\u95EE\u9898**\uFF1A
  1. \u539F\u6587\u6CA1\u8BF4\uFF0C\u662F\u63A8\u6D4B\u3001\u6309\u884C\u4E1A\u5E38\u8BC6\u8865\u7684\uFF08\u6BD4\u5982\u53EA\u8BF4"\u62CD\u8FC7\u89C6\u9891"\uFF0C\u5C31\u586B\u4E86\u8D26\u53F7\u5904\u5728\u4EC0\u4E48\u9636\u6BB5\uFF09
  2. \u503C\u548C\u539F\u6587\u5BF9\u4E0D\u4E0A\uFF1A\u6570\u5B57\u3001\u6863\u4F4D\u3001\u4EBA\u7FA4\u3001\u4EF7\u683C\uFF08"\u516B\u5343\u591A\u7C89"\u5E94\u8BE5\u662F 0-1\u4E07\uFF1B"\u4EBA\u5747120"\u5E94\u8BE5\u662F 50-200\u5143\uFF09
  3. \u628A\u522B\u4EBA\u7684\u60C5\u51B5\uFF08\u540C\u884C\u3001\u5BA2\u4EBA\u3001\u5BF9\u6807\u8D26\u53F7\uFF09\u5F53\u6210\u4E86\u8FD9\u4E2A\u5BA2\u6237\u7684
  4. \u628A"\u6253\u7B97\u505A\u3001\u60F3\u505A"\u5F53\u6210\u4E86"\u5DF2\u7ECF\u5728\u505A"
  5. \u8BF4\u5F97\u6BD4\u539F\u6587\u91CD\u3001\u6BD4\u539F\u6587\u591A\uFF08\u539F\u6587\u8BF4"\u6709\u65F6\u5019"\uFF0C\u5199\u6210\u4E86"\u4E00\u76F4"\uFF09
  6. \u4F9D\u636E\u548C\u8FD9\u4E00\u9879\u6CA1\u5173\u7CFB
  7. \u548C\u6863\u6848\u91CC\u522B\u7684\u9879\u4E92\u76F8\u77DB\u76FE\u3001\u6216\u8005\u6BD4\u522B\u7684\u9879\u5C11\u4E86\u4E1C\u897F\uFF08\u6BD4\u5982\u8D5B\u9053\u91CC\u6709\u4E09\u4E2A\u54C1\u7C7B\uFF0C\u9009\u9898\u65B9\u5411\u5374\u5199"\u4EE5\u5176\u4E2D\u4E24\u4E2A\u4E3A\u6838\u5FC3"\uFF1B
     \u4EA7\u54C1\u54C1\u7C7B\u53EA\u5199\u4E86\u300C\u9910\u996E\u300D\uFF0C\u6CA1\u5199\u5177\u4F53\u5356\u4EC0\u4E48\uFF09
- \u5B81\u53EF\u591A\u6807\uFF0C\u4E0D\u8981\u653E\u8FC7\u3002\u4F46\u539F\u6587\u786E\u5B9E\u8BF4\u4E86\u7684\uFF0C\u4E0D\u8981\u4E3A\u4E86\u6311\u9519\u786C\u6311\u3002

## \u8FD9\u4E9B\u4E0D\u7B97\u95EE\u9898\uFF08\u53EA\u6838\u610F\u601D\u5BF9\u4E0D\u5BF9\uFF0C\u4E0D\u6838\u63AA\u8F9E\uFF09
- \u6863\u6848\u5F88\u591A\u680F\u7528\u7684\u662F\u56FA\u5B9A\u7684**\u6807\u51C6\u8BF4\u6CD5**\uFF08\u6BCF\u9879\u540E\u9762\u62EC\u53F7\u91CC\u5217\u7740\uFF09\uFF1A\u628A\u539F\u6587\u7684\u610F\u601D\u5F52\u5230\u5BF9\u5E94\u7684\u6807\u51C6\u8BF4\u6CD5\u4E0A\u662F\u5BF9\u7684\uFF0C\u4E0D\u7B97"\u52A0\u5DE5"\u3002
  \u6BD4\u5982\u539F\u6587"\u6700\u5E38\u95EE\u725B\u8089\u662F\u4E0D\u662F\u5F53\u5929\u7684" \u2192 \u300C\u6015\u8D28\u91CF\u6709\u95EE\u9898\u300D\uFF1B"\u4E8C\u5341\u4E94\u5230\u4E09\u5341\u4E94\u5C81" \u2192 \u300C25-30\u5C81\u300131-40\u5C81\u300D\uFF1B"\u4EBA\u5747120" \u2192 \u300C50-200\u5143\u300D\u3002
  \u53EA\u6709\u5F52\u9519\u4E86\uFF08\u610F\u601D\u5BF9\u4E0D\u4E0A\uFF09\u624D\u7B97\u95EE\u9898\u3002
- \u4E0D\u8981\u56E0\u4E3A"\u53EF\u4EE5\u5199\u5F97\u66F4\u5177\u4F53"\u5C31\u6807\uFF08\u539F\u6587\u8BF4\u5728\u5E97\u91CC\u5207\u725B\u8089\uFF0C\u5199\u300C\u5E97\u94FA\u300D\u5C31\u662F\u5BF9\u7684\uFF09\u3002
- fix \u8981\u7528\u8FD9\u4E00\u9879\u7684\u6807\u51C6\u8BF4\u6CD5\uFF0C\u4E0D\u8981\u6539\u56DE\u539F\u6587\u7684\u5927\u767D\u8BDD\u3002

## \u6709\u95EE\u9898\u7684\u600E\u4E48\u5199
- reason\uFF1A\u4E00\u53E5\u5927\u767D\u8BDD\uFF0C\u8BF4\u539F\u6587\u662F\u600E\u4E48\u8BF4\u7684\u3001\u9519\u5728\u54EA\u3002\u6BD4\u5982"\u539F\u6587\u53EA\u8BF4\u62CD\u8FC7\u89C6\u9891\u3001\u516B\u5343\u591A\u7C89\uFF0C\u6CA1\u8BF4\u5B9A\u4F4D\u5B9A\u6CA1\u5B9A\uFF0C\u9636\u6BB5\u662F\u731C\u7684"
- fix\uFF1A\u5EFA\u8BAE\u6539\u6210\u4EC0\u4E48\uFF08\u5355\u9009\u9898\u53EA\u80FD\u662F\u9009\u9879\u539F\u6587\uFF09\uFF1B\u539F\u6587\u6839\u672C\u6CA1\u8BF4\u8FD9\u4EF6\u4E8B\uFF0Cfix \u5199 null\uFF0C\u610F\u601D\u662F\u5EFA\u8BAE\u4E0D\u586B

## \u63D0\u53D6\u7ED3\u679C
${rows}

## \u8F93\u51FA\u683C\u5F0F
\u6BCF\u4E00\u9879\u90FD\u8981\u7ED9\u7ED3\u8BBA\u3002\u53EA\u8F93\u51FA\u4E00\u4E2A JSON \u5BF9\u8C61\uFF0C\u4E0D\u8981\u4EFB\u4F55\u89E3\u91CA\u3001\u4E0D\u8981 Markdown \u4EE3\u7801\u5757\uFF1A
{"checks":{"\u5B57\u6BB5key":{"ok":true},"\u53E6\u4E00\u4E2Akey":{"ok":false,"reason":"\u2026","fix":\u2026\u6216null}}}

## \u524D\u91C7\u8BB0\u5F55\uFF08\u5230"\u524D\u91C7\u8BB0\u5F55\u7ED3\u675F"\u4E3A\u6B62\uFF09
${source}
\u524D\u91C7\u8BB0\u5F55\u7ED3\u675F`;
}
function applyCheck(ex, raw) {
  const data = extractJson(raw);
  const checks = data?.checks && typeof data.checks === "object" ? data.checks : {};
  const fields = ex.fields.map((f) => {
    const c = checks[f.key];
    if (!c || typeof c !== "object") return f;
    const o = c;
    if (o.ok !== false) return { ...f, check: { ok: true, reason: "" } };
    const spec = SPEC.get(f.key);
    const reason = clip(scrubSensitive(typeof o.reason === "string" ? o.reason.trim() : ""), 150) || "\u8FD9\u4E00\u9879\u548C\u539F\u6587\u5BF9\u4E0D\u4E0A\uFF0C\u8BF7\u6838\u5BF9";
    let fix;
    if (o.fix === null) fix = null;
    else if (o.fix !== void 0) fix = cleanValue(spec, o.fix) ?? void 0;
    const flat = (v) => norm(Array.isArray(v) ? v.join("\u3001") : v);
    if (fix !== void 0 && fix !== null && flat(fix) === flat(f.value)) return { ...f, check: { ok: true, reason: "" } };
    return { ...f, check: { ok: false, reason, ...fix !== void 0 ? { fix } : {} } };
  });
  return { ...ex, fields, checked: true };
}

// .tmp/content-audit-production_20261008/lib/context-manifest.ts
var BOARD_MANIFESTS = [
  {
    board: "topic",
    label: "\u9009\u9898\u7B56\u5212",
    job: '\u627E"\u5F80\u54EA\u4E2A\u65B9\u5411\u62CD"\u3002\u8981\u77E5\u9053\u8D5B\u9053\u3001\u8BF4\u7ED9\u8C01\u542C\u3001\u6709\u4EC0\u4E48\u53EF\u6316\u7684\u3001\u4EC0\u4E48\u4E0D\u80FD\u78B0',
    profile: ["account", "audience", "viral", "restrictions"],
    brief: ["oneline", "audience", "direction", "forbidden"],
    dealReasons: true
  },
  {
    board: "script",
    label: "\u811A\u672C\u751F\u6210",
    job: '\u51B3\u5B9A"\u600E\u4E48\u8BF4"\u3002\u53E3\u543B\u3001\u8BF4\u670D\u70B9\u3001\u8BB0\u5FC6\u70B9\uFF0C\u7F3A\u4E00\u6837\u90FD\u4F1A\u5199\u6210\u901A\u7A3F',
    profile: ["account", "audience", "tone", "selling", "restrictions"],
    brief: ["oneline", "persona", "audience", "direction", "trust", "memory", "forbidden"],
    dealReasons: true
  },
  {
    board: "storyboard",
    label: "\u5206\u955C\u811A\u672C",
    job: '\u51B3\u5B9A"\u600E\u4E48\u62CD"\u3002\u53EA\u5173\u5FC3\u771F\u5B9E\u62CD\u6444\u6761\u4EF6\u548C\u753B\u9762\uFF0C\u4E0D\u9700\u8981\u77E5\u9053\u53D8\u73B0\u8DEF\u5F84',
    // 分镜表里有台词一列，禁忌同样适用——这条是测试逮出来的，原来漏了
    profile: ["account", "shooting", "restrictions"],
    brief: ["oneline", "shooting", "memory", "forbidden"],
    dealReasons: false
  },
  {
    board: "review",
    label: "\u5BA1\u7A3F\u4F18\u5316",
    job: "\u5F53\u5224\u636E\u7528\u3002\u8BED\u6C14\u5BF9\u4E0D\u5BF9\u3001\u8BF4\u7684\u662F\u4E0D\u662F\u8FD9\u7FA4\u4EBA\u5173\u5FC3\u7684\u3001\u6709\u6CA1\u6709\u8E29\u7981\u5FCC",
    profile: ["account", "audience", "tone", "restrictions"],
    brief: ["oneline", "persona", "audience", "forbidden"],
    dealReasons: false
  },
  {
    board: "title",
    label: "\u6807\u9898\u5C01\u9762",
    job: "\u7ED9\u8C01\u770B\u3001\u51ED\u4EC0\u4E48\u70B9\u3002\u8981\u4EBA\u7FA4\u75DB\u70B9\u548C\u8BF4\u670D\u70B9\uFF0C\u4E0D\u9700\u8981\u62CD\u6444\u6761\u4EF6",
    profile: ["account", "audience", "selling", "restrictions"],
    brief: ["oneline", "audience", "trust", "forbidden"],
    dealReasons: true
  },
  {
    board: "dealReason",
    label: "\u6210\u4EA4\u7406\u7531",
    job: '\u627E"\u51ED\u4EC0\u4E48\u8BA9\u4EBA\u4E70"\u3002\u8981\u5356\u70B9\u3001\u53D8\u73B0\u8DEF\u5F84\u3001\u5BA2\u6237\u987E\u8651\u2014\u2014\u4E4B\u524D\u8FD9\u4E2A\u677F\u5757\u5B8C\u5168\u6CA1\u63A5\u4E0A\u4E0B\u6587',
    profile: ["account", "audience", "selling", "monetize", "restrictions"],
    brief: ["oneline", "audience", "trust", "forbidden"],
    dealReasons: false
    // 它本身就是产出成交理由的，不该拿旧的当输入
  },
  {
    board: "growth",
    label: "\u8D77\u53F7\u65B9\u6848",
    /*
     * 原来借用的是脚本那一套，没有拍摄条件、没有爆款基因——
     * 而起号的核心就是「按真实资源挑他拍得出来的打法」，
     * 提示词让模型对照团队、设备、场地去选，模型却一样都看不到。
     */
    job: '\u6311"\u4ED6\u62CD\u5F97\u51FA\u6765\u7684"\u6253\u6CD5\u3002\u8981\u771F\u5B9E\u62CD\u6444\u6761\u4EF6\u3001\u64C5\u957F\u4EC0\u4E48\u3001\u6570\u636E\u6700\u597D\u7684\u5185\u5BB9\u7C7B\u578B\u3001\u53D8\u73B0\u65B9\u5F0F',
    profile: ["account", "audience", "tone", "shooting", "monetize", "viral", "restrictions"],
    brief: ["oneline", "persona", "audience", "direction", "shooting", "forbidden"],
    dealReasons: false
  },
  {
    board: "freeChat",
    label: "\u9AD8\u9636\u81EA\u7531",
    job: "\u968F\u53E3\u95EE\u4EC0\u4E48\u90FD\u53EF\u80FD\u3002\u7ED9\u4E00\u4EFD\u8D26\u53F7\u5168\u8C8C\uFF0C\u8BA9\u5B83\u81F3\u5C11\u77E5\u9053\u4F60\u662F\u8C01\u3001\u505A\u4EC0\u4E48\u3001\u4E0D\u80FD\u8BF4\u4EC0\u4E48",
    profile: ["account", "audience", "tone", "selling", "shooting", "restrictions"],
    brief: ["oneline", "persona", "audience", "direction", "trust", "shooting", "forbidden"],
    dealReasons: false
  },
  /*
   * 下面三个是 2026-09-30 补接的（产品方："每个板块都要有记忆，互相关联互通"）。
   * 拆解和二创另外还传了整份档案摘要（lib/profile-summary，含经营品类、团队设备），
   * 所以档案这边只切禁忌，不重复塞。
   */
  {
    board: "breakdown",
    label: "\u62C6\u89E3\u7206\u6B3E",
    job: '\u62C6\u5B8C\u4E4B\u540E"\u5957\u5230\u8FD9\u4E2A\u8D26\u53F7\u4E0A"\u7ED9 3 \u4E2A\u9009\u9898\u3002\u8981\u77E5\u9053\u8D26\u53F7\u65B9\u5411\u548C\u8BF4\u7ED9\u8C01\u542C\uFF0C\u5957\u51FA\u6765\u7684\u9009\u9898\u624D\u4E0D\u8DD1\u504F',
    profile: ["restrictions"],
    brief: ["oneline", "audience", "direction", "forbidden"],
    dealReasons: false
  },
  {
    board: "remix",
    label: "\u8DE8\u884C\u4E1A\u4E8C\u521B",
    job: "\u628A\u522B\u7684\u884C\u4E1A\u7684\u7206\u6B3E\u6362\u6210\u8FD9\u4E2A\u8D26\u53F7\u7684\u8840\u8089\u3002\u8981\u4EBA\u8BBE\u53E3\u543B\u3001\u8BF4\u7ED9\u8C01\u542C\u3001\u51ED\u4EC0\u4E48\u4FE1\u4F60\u3001\u8BB0\u5FC6\u70B9\uFF0C\u5916\u52A0\u6210\u4EA4\u7406\u7531\u5F53\u7ED3\u5C3E\u7684\u8BF4\u670D\u70B9",
    profile: ["restrictions"],
    brief: ["oneline", "persona", "audience", "trust", "memory", "forbidden"],
    dealReasons: true
  },
  {
    board: "direction",
    label: "\u521B\u4F5C\u65B9\u5411",
    /*
     * 2026-10-02 新板块。档案摘要另传（含经营品类、团队设备），这里切的是方向判断要用的：
     * 已有的内容方向和爆款基因（别重复、接着长）、变现方式（目的要落到钱上）、拍摄条件（方向要拍得出来）
     */
    job: "\u5E26\u7740\u76EE\u7684\u627E\u65B9\u5411\uFF1A\u8981\u77E5\u9053\u8FD9\u4E2A\u53F7\u5B9A\u597D\u7684\u65B9\u5411\u3001\u8BF4\u7ED9\u8C01\u542C\u3001\u51ED\u4EC0\u4E48\u4FE1\u4F60\u3001\u80FD\u62CD\u4EC0\u4E48\u3001\u9760\u4EC0\u4E48\u8D5A\u94B1\uFF0C\u65B9\u5411\u624D\u80FD\u65E2\u8FBE\u5230\u76EE\u7684\u53C8\u62CD\u5F97\u51FA\u6765",
    profile: ["monetize", "viral", "restrictions"],
    brief: ["oneline", "persona", "audience", "direction", "trust", "shooting", "forbidden"],
    dealReasons: true
  },
  {
    board: "knowledge",
    label: "\u77E5\u8BC6\u5E93",
    job: "\u7B54\u65B9\u6CD5\u8BBA\u95EE\u9898\u3002\u77E5\u9053\u8FD9\u4E2A\u53F7\u662F\u505A\u4EC0\u4E48\u7684\u3001\u8BF4\u7ED9\u8C01\u542C\uFF0C\u4E3E\u4F8B\u65F6\u5C31\u80FD\u7528\u4ED6\u81EA\u5DF1\u7684\u884C\u4E1A\uFF0C\u800C\u4E0D\u662F\u6CDB\u6CDB\u800C\u8C08",
    profile: ["account", "restrictions"],
    brief: ["oneline", "audience", "forbidden"],
    dealReasons: false
  }
];
var BY_BOARD = new Map(BOARD_MANIFESTS.map((m) => [m.board, m]));
function manifestOf(board) {
  return BY_BOARD.get(board);
}
var BOARD_LABEL = Object.fromEntries(
  BOARD_MANIFESTS.map((m) => [m.board, m.label])
);

// .tmp/content-audit-production_20261008/lib/creative-brief.ts
var BRIEF_FIELDS = [
  {
    key: "oneline",
    label: "\u4E00\u53E5\u8BDD\u5B9A\u4F4D",
    spec: "\u4E0D\u8D85\u8FC730\u5B57\u3002[\u8EAB\u4EFD]+[\u7279\u70B9]+[\u4EF7\u503C]\uFF0C\u8981\u80FD\u8BA9\u964C\u751F\u4EBA\u7ACB\u523B\u77E5\u9053\u8FD9\u4E2A\u53F7\u662F\u5E72\u4EC0\u4E48\u7684\u3002",
    hint: "\u6240\u6709\u677F\u5757\u90FD\u4F1A\u8BFB\u5230\u8FD9\u53E5\uFF0C\u5199\u5F97\u8D8A\u51C6\uFF0C\u4EA7\u51FA\u8D8A\u4E0D\u8DD1\u504F"
  },
  {
    key: "persona",
    label: "\u4EBA\u8BBE\u4E0E\u53E3\u543B",
    spec: `\u5206\u56DB\u884C\u5199\uFF0C\u6BCF\u884C\u90FD\u8981\u80FD\u76F4\u63A5\u6307\u5BFC\u5199\u6587\u6848\uFF1A
- **\u6211\u662F\u8C01**\uFF1A\u4E00\u53E5\u80FD\u88AB\u89C2\u4F17\u590D\u8FF0\u7684\u4EBA\u8BBE\u6807\u7B7E
- **\u8BF4\u8BDD\u4EC0\u4E48\u8C03**\uFF1A\u5177\u4F53\u5230\u8BED\u6C14\u8BCD\u548C\u53E5\u5F0F\u4E60\u60EF\uFF0C\u4E0D\u8981\u5199"\u4EB2\u5207\u4E13\u4E1A"\u8FD9\u79CD
- **\u4F1A\u8BF4\u7684\u4E00\u53E5\u8BDD**\uFF1A\u4E3E\u4E00\u4E2A\u771F\u5B9E\u4F8B\u5B50
- **\u4E0D\u4F1A\u8BF4\u7684\u4E00\u53E5\u8BDD**\uFF1A\u4E3E\u4E00\u4E2A\u771F\u5B9E\u4F8B\u5B50\uFF08\u8FD9\u6761\u6BD4\u4E0A\u4E00\u6761\u66F4\u6709\u7528\uFF09`,
    hint: '\u811A\u672C\u548C\u5BA1\u7A3F\u9760\u8FD9\u6BB5\u5B9A\u53E3\u543B\u3002"\u4F1A\u8BF4/\u4E0D\u4F1A\u8BF4"\u5404\u4E3E\u4E00\u4F8B\uFF0C\u6BD4\u5F62\u5BB9\u8BCD\u7BA1\u7528\u5F97\u591A'
  },
  {
    key: "audience",
    label: "\u8BF4\u7ED9\u8C01\u542C",
    spec: `\u5206\u56DB\u884C\uFF1A
- **\u753B\u50CF**\uFF1A\u4E00\u53E5\u8BDD\uFF0C\u8981\u5177\u4F53\u5230\u80FD\u60F3\u8D77\u67D0\u4E2A\u771F\u5B9E\u7684\u4EBA
- **\u4ED6\u6700\u6015\u4EC0\u4E48**\uFF1A3\u6761\uFF0C\u6BCF\u6761\u90FD\u80FD\u76F4\u63A5\u62CD\u6210\u5185\u5BB9
- **\u4ED6\u6700\u60F3\u8981\u4EC0\u4E48**\uFF1A3\u6761
- **\u4ED6\u4F1A\u641C\u4EC0\u4E48\u8BCD**\uFF1A\u5199\u51FA\u4ED6\u771F\u4F1A\u6253\u51FA\u6765\u7684\u90A3\u51E0\u4E2A\u8BCD`,
    hint: "\u9009\u9898\u3001\u811A\u672C\u3001\u6807\u9898\u3001\u5BA1\u7A3F\u90FD\u8BFB\u8FD9\u6BB5\u3002\u75DB\u70B9\u5199\u5F97\u8D8A\u5177\u4F53\uFF0C\u9009\u9898\u8D8A\u597D\u51FA"
  },
  {
    key: "direction",
    label: "\u5185\u5BB9\u65B9\u5411",
    spec: `\u5206\u4E94\u884C\uFF1A
- **\u4E09\u79CD\u89C6\u9891\u7684\u914D\u6BD4**\uFF1A\u7167\u5B9A\u4F4D\u91CC\u5B9A\u7684\u6284\uFF0C\u5199\u6210"\u6D41\u91CF\u578BX%\uFF08\u4E3B\u6253\u4EC0\u4E48\uFF09+ \u4EBA\u8BBE\u578BX%\uFF08\u4E3B\u6253\u4EC0\u4E48\uFF09+ \u53D8\u73B0\u578BX%\uFF08\u4E3B\u6253\u4EC0\u4E48\uFF09"\u2014\u2014\u914D\u6BD4\u8BF4\u7684\u662F\u76EE\u7684\uFF0C\u4E0D\u662F\u811A\u672C\u7C7B\u578B
- **\u5404\u81EA\u7684\u7ED3\u5C3E\u6307\u4EE4**\uFF1A\u6D41\u91CF\u578B\u8981\u4EC0\u4E48\u3001\u4EBA\u8BBE\u578B\u8981\u4EC0\u4E48\u3001\u53D8\u73B0\u578B\u8981\u4EC0\u4E48\uFF0C\u6BCF\u79CD\u53EA\u4E00\u4E2A
- **\u4E24\u5957\u6253\u6CD5\u5404\u7528\u4EC0\u4E48**\uFF1A\u56DB\u5927\u811A\u672C\u4E3B\u6253\u54EA\u51E0\u79CD\u7ED3\u6784\uFF1B\u8D77\u53F736\u8BA1\u4E3B\u6253\u54EA\u51E0\u8BA1\uFF08\u5199\u8BA1\u540D\uFF0C\u7167\u5B9A\u4F4D\u91CC\u6311\u7684\u6765\uFF09
- **\u80FD\u957F\u671F\u6316\u7684\u9009\u9898\u6765\u6E90**\uFF1A4-5\u4E2A\uFF0C\u6BCF\u4E2A\u4E3E\u4E00\u4E2A\u5177\u4F53\u4F8B\u5B50
- **\u660E\u786E\u4E0D\u505A\u7684\u65B9\u5411**\uFF1A3\u6761\uFF0C\u8BF4\u660E\u4E3A\u4EC0\u4E48\u4E0D\u505A`,
    hint: '"\u4E0D\u505A\u4EC0\u4E48"\u548C"\u505A\u4EC0\u4E48"\u4E00\u6837\u91CD\u8981\u2014\u2014\u5B83\u80FD\u6321\u4F4F\u8DD1\u504F\u7684\u9009\u9898'
  },
  {
    key: "trust",
    label: "\u51ED\u4EC0\u4E48\u4FE1\u4F60",
    spec: `\u5206\u4E24\u884C\uFF1A
- **\u6838\u5FC3\u5356\u70B9**\uFF1A2-3\u6761\uFF0C\u6BCF\u6761\u4E00\u53E5\u8BDD
- **\u53EF\u4EE5\u62CD\u6210\u753B\u9762\u7684\u8BC1\u636E**\uFF1A4-6\u6761\uFF0C\u5FC5\u987B\u662F\u80FD\u771F\u5B9E\u62CD\u5230\u7684\u4E1C\u897F\uFF0C\u4E0D\u662F\u5F62\u5BB9\u8BCD`,
    hint: '\u811A\u672C\u548C\u6807\u9898\u9760\u8FD9\u6BB5\u627E\u8BF4\u670D\u70B9\u3002\u8BC1\u636E\u8981\u80FD\u62CD\u51FA\u6765\uFF0C\u4E0D\u80FD\u662F"\u54C1\u8D28\u597D"\u8FD9\u79CD'
  },
  {
    key: "shooting",
    label: "\u600E\u4E48\u62CD",
    spec: `\u5206\u4E09\u884C\uFF1A
- **\u5448\u73B0\u5F62\u5F0F**\uFF1A\u53E3\u64AD/\u63A2\u5E97/Vlog/\u60C5\u666F\u5267\u7B49\uFF0C\u4E00\u53E5\u8BDD\u8BF4\u660E\u4E3A\u4EC0\u4E48\u662F\u5B83
- **\u771F\u5B9E\u6761\u4EF6**\uFF1A\u8BBE\u5907\u3001\u573A\u5730\u3001\u4E00\u4E2A\u4EBA\u8FD8\u662F\u6709\u5E2E\u624B\u3001\u4E00\u5468\u80FD\u51FA\u51E0\u6761
- **\u89C6\u89C9\u8C03\u6027**\uFF1A\u5149\u7EBF\u3001\u8272\u5F69\u3001\u955C\u5934\u7A33\u4E0D\u7A33\uFF0C\u4E00\u53E5\u8BDD`,
    hint: "\u5206\u955C\u53EA\u8BFB\u8FD9\u4E00\u6BB5\u3002\u5199\u51C6\u4E86\uFF0C\u5206\u955C\u5C31\u4E0D\u4F1A\u7ED9\u51FA\u62CD\u4E0D\u51FA\u6765\u7684\u65B9\u6848"
  },
  {
    key: "memory",
    label: "\u8BB0\u5FC6\u70B9",
    spec: "2-3\u6761\u3002\u8BED\u8A00/\u52A8\u4F5C/\u9053\u5177/\u670D\u88C5/\u573A\u666F\u58F0\u97F3\u91CC\u6311\uFF0C\u6BCF\u6761\u8BF4\u660E\u600E\u4E48\u91CD\u590D\u3002\u6807\u660E\u54EA\u4E9B\u8FD8\u5F85\u9A8C\u8BC1\u3002",
    hint: "\u56FA\u5B9A\u7684\u53E3\u5934\u7985\u3001\u624B\u52BF\u3001\u9053\u5177\u2014\u2014\u8BA9\u89C2\u4F17\u80FD\u590D\u8FF0\u4F60"
  },
  {
    key: "forbidden",
    label: "\u7EDD\u5BF9\u4E0D\u80FD\u8BF4",
    spec: "\u9010\u6761\u5217\u51FA\u3002\u5305\u542B\u8D26\u53F7\u81EA\u5DF1\u7684\u7981\u5FCC\u548C\u901A\u7528\u7EA2\u7EBF\uFF08\u7EDD\u5BF9\u5316\u7528\u8BED\u3001\u627F\u8BFA\u7597\u6548\u7B49\uFF09\u3002",
    hint: "\u786C\u7EA6\u675F\uFF0C\u6240\u6709\u677F\u5757\u90FD\u4F1A\u5E26\u4E0A\u3002\u6F0F\u4E00\u6761\u53EF\u80FD\u76F4\u63A5\u8FDD\u89C4"
  }
];
var BY_KEY = new Map(BRIEF_FIELDS.map((f) => [f.key, f]));
function parseBrief(markdown) {
  const out = {};
  if (!markdown?.trim()) return out;
  const lines = markdown.split("\n");
  let current = null;
  let buf = [];
  const flush = () => {
    if (current) out[current] = buf.join("\n").trim();
    buf = [];
  };
  for (const line2 of lines) {
    const m = line2.match(/^#{2,4}\s*(?:\d+[.、]\s*)?(.+?)\s*$/);
    if (m) {
      const hit = BRIEF_FIELDS.find((f) => m[1].includes(f.label));
      if (hit) {
        flush();
        current = hit.key;
        continue;
      }
    }
    if (current) buf.push(line2);
  }
  flush();
  return out;
}
function briefBlockFor(markdown, board) {
  const want = manifestOf(board)?.brief ?? [];
  const values = parseBrief(markdown);
  const picked = BRIEF_FIELDS.filter((f) => want.includes(f.key) && values[f.key]?.trim());
  if (picked.length === 0) return "";
  const body = picked.map((f) => `### ${f.label}

${values[f.key].trim()}`).join("\n\n");
  return `## \u{1F9ED} \u521B\u4F5C\u7B80\u62A5\uFF08\u8FD9\u4E2A\u53F7\u5DF2\u7ECF\u5B9A\u597D\u7684\u65B9\u5411\uFF09

${body}

\u4EE5\u4E0A\u662F\u8D26\u53F7\u7684\u957F\u671F\u521B\u4F5C\u80CC\u666F\uFF0C\u7528\u4E8E\u8F85\u52A9\u7406\u89E3\u4EBA\u8BBE\u3001\u8BED\u6C14\u3001\u4E8B\u5B9E\u4E0E\u7981\u5FCC\u3002\u672C\u6761\u7684\u4E3B\u9898\u3001\u4EBA\u7FA4\u3001\u76EE\u7684\u548C\u8868\u8FBE\u4EE5\u5F53\u524D\u539F\u7A3F\u53CA\u7528\u6237\u660E\u786E\u8981\u6C42\u4E3A\u51C6\uFF1B\u4E0D\u80FD\u7528\u957F\u671F\u5546\u4E1A\u5B9A\u4F4D\u66FF\u6362\u672C\u6B21\u89C2\u5BDF\u3001\u8BA8\u8BBA\u6216\u5176\u4ED6\u5185\u5BB9\u76EE\u7684\u3002\u56F4\u7ED5\u7528\u6237\u5F53\u524D\u9009\u62E9\u6DF1\u5316\uFF0C\u4E0D\u8981\u53E6\u8D77\u7089\u7076\u3002`;
}
var BRIEF_FACT_FIELDS = [
  "profile_name",
  "account_platform",
  "account_track",
  "account_stage",
  "product_category",
  "price_range",
  "monetization_model",
  "target_gender",
  "target_age",
  "target_region",
  "target_occupation",
  "target_pain_points",
  "target_needs",
  "target_interests",
  "content_style",
  "content_format",
  "content_tone",
  "content_themes",
  "competitive_advantage",
  "unique_resources",
  "interview_highlights",
  // 人设事实卡改了，简报里的人设当然就旧了
  "persona_facts"
];
var BRIEF_FACTS_PREFIX = "profile-facts:";
function profileFactsFingerprint(profile) {
  const p = profile ?? {};
  const norm2 = (v) => Array.isArray(v) ? v.filter(Boolean).map(String).map((x) => x.trim()).join("\u3001") : v && typeof v === "object" ? JSON.stringify(Object.fromEntries(Object.entries(v).filter(([, x]) => x != null && x !== "").sort(([a], [b]) => a.localeCompare(b)))) : v == null ? "" : String(v).trim();
  const text3 = BRIEF_FACT_FIELDS.filter((k) => k !== "persona_facts" || !["", "{}"].includes(norm2(p[k]))).map((k) => `${k}=${norm2(p[k])}`).join("\n");
  let h = 2166136261;
  for (let i = 0; i < text3.length; i++) {
    h ^= text3.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return BRIEF_FACTS_PREFIX + h.toString(16).padStart(8, "0");
}
function briefFactsChanged(briefFacts, profile) {
  if (!profile || !briefFacts || !briefFacts.startsWith(BRIEF_FACTS_PREFIX)) return false;
  return briefFacts !== profileFactsFingerprint(profile);
}

// .tmp/content-audit-production_20261008/lib/content-roles.ts
var CONTENT_ROLE_LIST = ["\u6D41\u91CF\u578B", "\u4EBA\u8BBE\u578B", "\u53D8\u73B0\u578B"];
var ROLE_SPECS = {
  \u6D41\u91CF\u578B: {
    job: "\u8BA9\u66F4\u591A\u65B0\u7528\u6237\u770B\u5230\u8D26\u53F7\uFF1A\u6269\u66DD\u5149\u3001\u62C9\u65B0\u7C89",
    directions: "\u70ED\u70B9\u3001\u4E89\u8BAE\u3001\u957F\u89C1\u8BC6\u3001\u53CD\u8BA4\u77E5\uFF1B\u5341\u5927\u7206\u6B3E\u65B9\u5411\u91CC\u7684\u53CD\u8BA4\u77E5\u3001\u4E30\u5BCC\u8C08\u8D44\u3001\u5171\u9E23\u89C2\u70B9\u3001\u4E0D\u540C\u89C6\u89D2\u3001\u4E2A\u4EBA\u6545\u4E8B\u90FD\u80FD\u505A\u6D41\u91CF\u3002\u8986\u76D6\u8D8A\u5E7F\u4E0A\u9650\u8D8A\u9AD8\u2014\u2014\u7528\u5927\u4F17\u5165\u53E3\u627F\u8F7D\u4E13\u4E1A\uFF08\u5496\u5561\u8C46\u600E\u4E48\u6311 \u2192 \u5404\u56FD\u5496\u5561\u4F18\u7F3A\u70B9 \u2192 \u77E5\u540D\u8FDE\u9501\u7684\u5496\u5561\u8C46\u79D8\u5BC6\uFF09",
    scriptTypes: "\u4E3B\u529B\u662F\u804A\u89C2\u70B9\uFF1B\u8D77\u53F7\u4E09\u5341\u516D\u8BA1\u5927\u591A\u662F\u6D41\u91CF\u6253\u6CD5\uFF1B\u6CDB\u77E5\u8BC6\uFF08\u5927\u4F17\u542C\u5F97\u61C2\u3001\u613F\u610F\u8F6C\u8FF0\u7684\u77E5\u8BC6\uFF09\u4E5F\u80FD\u505A\u6D41\u91CF",
    structures: [
      "\u89C2\u70B9\u5E76\u5217\uFF1A\u63D0\u51FA\u89C2\u70B9 \u2192 \u8BBA\u636E1 / \u8BBA\u636E2 / \u8BBA\u636E3 \u2192 \u603B\u7ED3\u5F3A\u5316",
      "\u89C2\u70B9\u6B63\u53CD\uFF1A\u63D0\u51FA\u89C2\u70B9 \u2192 \u6B63\u53CD\u5BF9\u6BD4\uFF08\u5E38\u89C1\u8BEF\u533A vs \u6B63\u786E\u770B\u6CD5\uFF09\u2192 \u5F3A\u5316\u7ED3\u8BBA",
      '\u4E89\u8BAE\u5F00\u7BC7\uFF1A\u5426\u5B9A\u53E5\u5F00\u573A\uFF08"\u6211\u4E0D\u8BA4\u4E3A\u2026\u2026"\uFF09\u2192 3 \u4E2A\u8BBA\u636E \u2192 \u603B\u7ED3\u5F52\u7EB3',
      "\u4E09\u5341\u516D\u8BA1\u6253\u6CD5\uFF1A\u6309\u6240\u9009\u90A3\u4E00\u8BA1\u7684\u7ED3\u6784\u516C\u5F0F\u8D70\uFF08\u5982 \u53CD\u5411\u64CD\u4F5C\uFF1A\u5E38\u89C4A \u2192 \u53CD\u5411B \u2192 \u771F\u5B9E\u53CD\u5E94/\u7ED3\u679C\uFF09"
    ],
    planning: "\u5148\u627E\u5199\u4F5C\u5BF9\u8C61\uFF08\u7ED9\u8C01\u770B\uFF09\u548C\u4ED6\u8EAB\u8FB9\u7684\u4EBA\u7269\u5173\u7CFB / \u884C\u4E1A\u91CC\u7684\u51B2\u7A81\u4E8B\u4EF6\uFF0C\u518D\u9009\u7ACB\u573A\uFF1B\u89C2\u70B9\u7684\u6838\u5FC3\u662F\u60C5\u7EEA\u4EF7\u503C\u2014\u2014\u548C\u7528\u6237\u7AD9\u5728\u4E00\u8D77\uFF0C\u7ED9\u4ED6\u60F3\u505A\u7684\u4E8B\u627E\u7406\u7531\uFF0C\u4E0D\u8BF4\u6559\u3002\u9009\u9898\u8FC7\u4E09\u5173\uFF1A\u8986\u76D6\u591F\u4E0D\u591F\u5E7F\u3001\u6709\u6CA1\u6709\u660E\u786E\u4EF7\u503C\u3001\u662F\u4E0D\u662F\u6BD4\u7528\u6237\u591A\u4E00\u6B65\u8BA4\u77E5",
    metrics: "\u89E6\u8FBE\u3001\u505C\u7559\u3001\u5206\u4EAB\u3001\u65B0\u7C89",
    cta: '\u5173\u6CE8\u6216\u8BC4\u8BBA\uFF0C\u4E8C\u9009\u4E00\uFF08"\u4F60\u4EEC\u90A3\u8FB9\u4E5F\u8FD9\u6837\u5417\uFF1F\u8BC4\u8BBA\u533A\u8BF4\u8BF4"\uFF09',
    pitfalls: "\u53EA\u8BB2\u884C\u4E1A\u5E72\u8D27\uFF08\u53D7\u4F17\u7A84\u3001\u6D41\u91CF\u4E0A\u9650\u4F4E\uFF09\uFF1B\u4E3A\u4E86\u6D41\u91CF\u62CD\u8DDF\u76EE\u6807\u4EBA\u7FA4\u65E0\u5173\u7684\u5185\u5BB9\uFF08\u6DA8\u7684\u662F\u6CDB\u7C89\uFF09",
    hook: "\u5927\u4F17\u90FD\u542C\u5F97\u61C2\u7684\u53CD\u8BA4\u77E5\u3001\u4E89\u8BAE\u3001\u957F\u89C1\u8BC6\u2014\u2014\u8986\u76D6\u8D8A\u5E7F\u8D8A\u597D\uFF0C\u4E00\u4E0A\u6765\u522B\u7528\u884C\u4E1A\u9ED1\u8BDD",
    shots: "\u4EBA\u7269\u8868\u60C5\u548C\u60C5\u7EEA\u53CD\u5E94\u3001\u89C2\u70B9\u5927\u5B57\u5B57\u5E55\uFF1B\u8282\u594F\u5FEB\uFF0C\u4FE1\u606F\u70B9\u5BC6"
  },
  \u4EBA\u8BBE\u578B: {
    job: "\u8BA9\u770B\u8FC7\u7684\u4EBA\u8BB0\u4F4F\u4F60\u3001\u4FE1\u4F60\u8FD9\u4E2A\u4EBA\uFF1A\u5EFA\u7ACB\u6DF1\u5EA6\u4FE1\u4EFB",
    directions: "\u6210\u957F\u6545\u4E8B\u3001\u804C\u4E1A\u7ECF\u5386\u3001\u5173\u7CFB\u7EC6\u8282\uFF08\u548C\u5BA2\u6237\u3001\u5BB6\u4EBA\u3001\u5458\u5DE5\u3001\u540C\u884C\uFF09\u3001\u4EF7\u503C\u89C2\u548C\u8FB9\u754C\uFF08\u4EC0\u4E48\u94B1\u4E0D\u8D5A\u3001\u4EC0\u4E48\u5BA2\u6237\u4E0D\u63A5\uFF09",
    scriptTypes: "\u4E3B\u529B\u662F\u8BB2\u6545\u4E8B",
    structures: [
      "\u5C0F\u6709\u6210\u5C31 / \u4E2A\u4EBA\u6210\u5C31\uFF1A\u7ED3\u679C\u94A9\u5B50 \u2192 \u963B\u788D1 \u2192 \u8F6C\u673A1 \u2192 \u963B\u788D2 \u2192 \u8F6C\u673A2 \u2192 \u611F\u609F\uFF08\u4E24\u7EC4\u963B\u788D-\u8F6C\u673A\u5C31\u591F\uFF0C\u4E09\u7EC4\u4EE5\u4E0A\u62D6\uFF09",
      "\u82E6\u96BE\u7ECF\u5386\uFF1A\u4F4E\u8C37 \u2192 \u6323\u624E \u2192 \u987F\u609F \u2192 \u9006\u88AD\uFF08\u82E6\u96BE\u8981\u7B11\u7740\u8BB2\uFF0C\u4E0D\u54ED\u8BC9\uFF09",
      "\u5E73\u51E1\u82F1\u96C4\uFF1A\u666E\u901A\u4EBA \u2192 \u4E00\u4EF6\u4E0D\u666E\u901A\u7684\u5C0F\u4E8B \u2192 \u7EC6\u8282\u9A8C\u8BC1 \u2192 \u611F\u609F",
      "\u8D35\u4EBA\u76F8\u52A9\uFF1A\u8D1F\u9762/\u610F\u5916\u5207\u5165 \u2192 \u5C0F\u5584\u610F \u2192 \u9690\u85CF\u8EAB\u4EFD \u2192 \u56DE\u62A5\u53CD\u8F6C \u2192 \u8F6F\u690D\u5165",
      "\u77E5\u6069\u56FE\u62A5\uFF1A\u4F2A\u7F3A\u70B9 \u2192 \u4E8B\u4EF6\u9A8C\u8BC1 \u2192 \u611F\u609F \u2192 \u5B9E\u9645\u56DE\u62A5",
      "\u4E16\u4FD7\u504F\u89C1\uFF1A\u786E\u7ACB\u504F\u89C1 \u2192 \u8BEF\u89E3 \u2192 \u6D88\u9664 \u2192 \u518D\u8BEF\u89E3/\u6D88\u9664 \u2192 \u53CD\u601D\u5347\u534E"
    ],
    planning: '\u4ECE\u771F\u5B9E\u7ECF\u5386\u91CC\u627E"\u90A3\u4E00\u523B"\u2014\u2014\u6700\u80FD\u8BC1\u660E\u8FD9\u4E2A\u4EBA\u7684\u4E00\u4E2A\u6210\u5C31\u3001\u632B\u6298\u3001\u8D35\u4EBA\u6216\u9057\u61BE\uFF0C\u653E\u5728\u4E2D\u95F4\u505A\u9AD8\u6F6E\uFF1B\u7EC6\u8282\u9A8C\u8BC1\u6BD4\u91D1\u53E5\u91CD\u8981\uFF0C\u7ED3\u679C\u524D\u7F6E\uFF0C\u7ED3\u5C3E\u56DE\u6536',
    metrics: '\u4E3B\u9875\u8BBF\u95EE\u3001\u5173\u6CE8\u3001\u8BC4\u8BBA\u8D28\u91CF\uFF08\u6709\u6CA1\u6709\u4EBA\u8BF4"\u5C31\u51B2\u4F60\u8FD9\u4E2A\u4EBA"\uFF09',
    cta: "\u5173\u6CE8\uFF0C\u6216\u8005\u5F15\u5BFC\u770B\u4E3B\u9875\uFF0C\u4E8C\u9009\u4E00",
    pitfalls: "\u7F16\u9020\u7ECF\u5386\u3001\u717D\u60C5\u8FC7\u5EA6\u3001\u8282\u594F\u6162\uFF1B\u628A\u4EBA\u8BBE\u5199\u6210\u5F62\u5BB9\u8BCD\uFF08\u4E13\u4E1A\u3001\u9760\u8C31\uFF09\u800C\u4E0D\u662F\u5177\u4F53\u7684\u4E8B",
    hook: '\u7ED3\u679C\u524D\u7F6E\u6216"\u90A3\u4E00\u523B"\u7684\u753B\u9762\u2014\u2014\u5148\u8BA9\u4EBA\u597D\u5947"\u8FD9\u4E2A\u4EBA\u7ECF\u5386\u4E86\u4EC0\u4E48"',
    shots: "\u7EC6\u8282\u955C\u5934\uFF08\u624B\u3001\u5DE5\u5177\u3001\u65E7\u7269\u3001\u5E97\u91CC\u7684\u89D2\u843D\uFF09\u548C\u771F\u5B9E\u73AF\u5883\uFF0C\u5C11\u6446\u62CD\uFF1B\u5173\u952E\u90A3\u4E00\u523B\u7ED9\u7279\u5199"
  },
  \u53D8\u73B0\u578B: {
    job: "\u76F4\u63A5\u63A8\u52A8\u76EE\u6807\u7528\u6237\u54A8\u8BE2\u3001\u5230\u5E97\u3001\u4E0B\u5355",
    directions: "\u670D\u52A1\u8FC7\u7A0B\u3001\u5BA2\u6237\u6848\u4F8B\u548C\u7ED3\u679C\u3001\u4EA7\u54C1\u4F7F\u7528\u3001\u4E13\u4E1A\u5224\u65AD\uFF1B\u6BCF\u6761\u90FD\u8981\u843D\u5728\u4E00\u4E2A\u6210\u4EA4\u7406\u7531\u4E0A\uFF08\u5BA2\u4EBA\u4E3A\u4EC0\u4E48\u4E70\u4F60\uFF09",
    scriptTypes: '\u4E3B\u529B\u662F\u6559\u77E5\u8BC6\u548C\u6652\u8FC7\u7A0B\uFF1B\u8BB2\u6545\u4E8B\u91CC\u7684"\u6210\u529F\u6848\u4F8B\u578B"\uFF08\u6211\u5E2E\u4ED6\uFF09\u4E5F\u5C5E\u4E8E\u53D8\u73B0\u578B',
    structures: [
      '\u6652\u8FC7\u7A0B\xB7\u706B\u8F66\u8282\uFF1A\u8D77\u56E0\uFF08\u5E26\u94A9\u5B50\uFF09\u2192 \u5173\u952E\u6B65\u9AA4 \u2192 \u7ED3\u679C\uFF08\u79BB\u53D8\u73B0\u6700\u8FD1\u2014\u2014\u8BC4\u8BBA\u591A\u662F"\u6211\u8BE5\u600E\u4E48\u5F04"\uFF09',
      "\u6652\u8FC7\u7A0B\xB7\u8FC7\u7A0B\u5C55\u793A\uFF1A\u8FDB\u8D27 \u2192 \u6210\u4EA4 \u2192 \u6280\u672F \u2192 \u552E\u540E\uFF0C\u6311\u4E00\u6BB5\u62CD\u900F",
      "\u6559\u77E5\u8BC6\xB7\u89E3\u9898\u578B\uFF1A\u573A\u666F\u96BE\u9898 \u2192 \u653E\u5927\u5371\u673A \u2192 \u4F4E\u6210\u672C\u89E3\u51B3 \u2192 \u64CD\u4F5C\u6B65\u9AA4 12345",
      "\u6559\u77E5\u8BC6\xB7\u63A8\u8350\u578B\uFF1A\u7F8E\u597D\u613F\u666F \u2192 \u5708\u5B9A\u4EBA\u7FA4 \u2192 \u5F15\u53D1\u597D\u5947 \u2192 \u63A8\u8350\u7406\u7531 12345\uFF08\u5BB9\u6613\u7684\u653E\u4E24\u5934\uFF0C\u96BE\u7684\u653E\u4E2D\u95F4\uFF09",
      "\u6559\u77E5\u8BC6\xB7\u6848\u4F8B\u5F15\u5165\uFF1A\u6709\u6570\u636E/\u51B2\u7A81\u7684\u6848\u4F8B \u2192 \u63D0\u70BC\u65B9\u6CD5 \u2192 \u666E\u901A\u4EBA\u600E\u4E48\u7528",
      '\u8BB2\u6545\u4E8B\xB7\u6210\u529F\u6848\u4F8B\uFF1A\u5BA2\u6237\u7684\u56F0\u5883 \u2192 \u6211\u5E2E\u4ED6\u505A\u4E86\u4EC0\u4E48 \u2192 \u4ED6\u81EA\u5DF1\u7684\u52AA\u529B \u2192 \u7ED3\u679C\uFF08"\u6211\u5E2E\u4ED6"\u548C"\u4ED6\u7684\u52AA\u529B"\u7F3A\u4E00\u4E0D\u53EF\uFF09'
    ],
    planning: "\u4E09\u8BCD\u6839\uFF1A\u4EBA\u7FA4\u8BCD\u6839 \xD7 \u573A\u666F\u8BCD\u6839 \xD7 \u884C\u4E1A\u8BCD\u6839\uFF08\u4EA7\u54C1\u5DE5\u827A / \u6280\u672F\u670D\u52A1 / \u8D5B\u9053\u54C1\u7C7B / \u4EF7\u683C\u6210\u672C / \u670D\u52A1\u4FE1\u4EFB\uFF09\uFF1B\u884C\u4E1A\u8BCD\u6839\u91CC\u653E\u771F\u5B9E\u5356\u70B9\uFF0C\u5148\u7ED9\u4EF7\u503C\u518D\u8C08\u6210\u4EA4\uFF0C\u4E0D\u662F\u786C\u5E7F",
    metrics: "\u54A8\u8BE2\u3001\u7EBF\u7D22\u3001\u6210\u4EA4\u3001\u590D\u8D2D",
    cta: "\u79C1\u4FE1\u3001\u5230\u5E97\u3001\u7559\u8D44\u91CC\u53EA\u9009\u4E00\u4E2A\uFF0C\u8BF4\u6E05\u695A\u53BB\u54EA\u3001\u600E\u4E48\u505A",
    pitfalls: "\u786C\u5E7F\uFF08\u53EA\u8BB2\u4EA7\u54C1\u4E0D\u8BB2\u7528\u6237\u5173\u5FC3\u4EC0\u4E48\uFF09\uFF1B\u53EA\u6652\u7ED3\u679C\u4E0D\u6652\u8FC7\u7A0B\uFF08\u770B\u7740\u50CF\u5047\u7684\uFF09\uFF1B\u4E00\u6761\u89C6\u9891\u91CC\u4E09\u4E2A\u6307\u4EE4\u90FD\u8981",
    hook: "\u76F4\u63A5\u70B9\u51FA\u76EE\u6807\u4EBA\u7FA4\u7684\u5177\u4F53\u96BE\u9898\u6216\u7ED3\u679C\u2014\u2014\u7CBE\u51C6\u6BD4\u5E7F\u91CD\u8981\uFF0C\u70B9\u8FDB\u6765\u7684\u8981\u662F\u4F1A\u4E70\u7684\u4EBA",
    shots: "\u8FC7\u7A0B\u548C\u7ED3\u679C\u7684\u5B9E\u62CD\uFF08\u64CD\u4F5C\u7279\u5199\u3001\u524D\u540E\u5BF9\u6BD4\u3001\u5BA2\u6237\u771F\u5B9E\u53CD\u5E94\uFF09\uFF0C\u8981\u6709\u8BC1\u636E\u611F\uFF1B\u7ED3\u5C3E\u7ED9\u5230\u5E97\u6216\u79C1\u4FE1\u7684\u6307\u5F15\u753B\u9762"
  }
};
var TACTIC_ROLES = {
  \u53D8\u73B0\u578B: [
    "\u60C5\u5883\u8FD8\u539F",
    "\u6B63\u786E\u505A\u6CD5VS\u9519\u8BEF\u505A\u6CD5",
    "\u5BF9\u6BD4\u6539\u9020",
    "\u4E92\u8054\u7F51\u5634\u66FF/\u66FF\u7F51\u53CB\u505A",
    "\u63A5\u53D7\u7F51\u53CB\u6311\u6218",
    "\u884C\u4E1A\u907F\u5751",
    "\u63A8\u8350\u5EFA\u8BAE",
    "\u61D2\u4EBA\u5B66\u4E60",
    "\u5185\u5E55\u63ED\u79D8",
    "\u626E\u732A\u5403\u864E"
  ],
  \u4EBA\u8BBE\u578B: ["\u4E00\u53E5\u8BDD\u8BBE\u5B9A\u6545\u4E8B\u611F", "\u52A0\u5165\u4EBA\u7269\u5173\u7CFB", "\u501F\u7269\u55BB\u4EBA", "\u5BA0\u59BB/\u5BA0\u592B\u53CD\u5DEE", "\u4EE5\u7269\u6362\u7269", "\u8D60\u9001\uFF1A\u8EAB\u4EFD\u53CD\u5DEE"],
  \u6D41\u91CF\u578B: [
    "\u53CD\u5411\u64CD\u4F5C",
    "\u8DE8\u754C\u786C\u7EC4\u5408",
    "\u8F6F\u7EC4\u5408\uFF1A\u7528A\u65B9\u5F0F\u505AB\u4E8B",
    "\u4E00\u4EBA\u5206\u9970\u591A\u89D2",
    "Rap+\u884C\u4E1A",
    "\u501F\u52BF\u70B9\u8BC4",
    "\u8DDF\u7740\u535A\u4E3B\u505A",
    "\u6A21\u4EFF\u7535\u5F71\u7247\u6BB5",
    "\u6574\u86CA",
    "\u6C42\u52A9\u7F51\u53CB",
    "\u62DF\u4EBA\u5316",
    "\u62DF\u7269\u5316",
    "\u66B4\u8E81\u6001\u5EA6",
    "\u4E92\u6362\u8EAB\u4EFD",
    "\u6000\u65E7\u590D\u53E4",
    "\u5410\u69FD\u5947\u8469\u73B0\u8C61",
    "\u89D2\u8272\u626E\u6F14",
    "\u5357\u5317/\u5730\u57DF\u5DEE\u5F02",
    "\u6362\u4E2A\u89C6\u89D2",
    "\u8857\u5934\u91C7\u8BBF",
    "\u51B7\u77E5\u8BC6"
  ]
};
function roleOfTactic(name) {
  for (const r of CONTENT_ROLE_LIST) if (TACTIC_ROLES[r].includes(name)) return r;
  return null;
}
var ROLE_RULES = `**\u4E09\u6761\u94C1\u5F8B**\uFF08\u4EE3\u8FD0\u8425 SOP \u539F\u8BDD\uFF09\uFF1A
- **\u6BCF\u6761\u89C6\u9891\u53EA\u9009\u4E00\u4E2A\u4E3B\u76EE\u7684**\u2014\u2014\u6D41\u91CF\u3001\u4EBA\u8BBE\u3001\u53D8\u73B0\u4E09\u4E2A\u90FD\u8981\uFF0C\u7B49\u4E8E\u4E09\u4E2A\u90FD\u5931\u8D25
- **\u76EE\u7684\u51B3\u5B9A\u4E00\u5207**\uFF1A\u9009\u9898\u65B9\u5411\u3001\u811A\u672C\u7ED3\u6784\u3001\u7ED3\u5C3E\u884C\u52A8\u6307\u4EE4\u90FD\u8DDF\u7740\u76EE\u7684\u8D70\uFF0C\u8FD9\u4E00\u6B65\u4E0D\u80FD\u8DF3
- **\u7ED3\u5C3E\u884C\u52A8\u6307\u4EE4\u53EA\u8981\u4E00\u4E2A**\uFF1A\u5173\u6CE8\u3001\u8BC4\u8BBA\u3001\u79C1\u4FE1\u3001\u5230\u5E97\uFF0C\u9009\u4E00\u4E2A\u8BF4\u6E05\u695A\uFF0C\u4E0D\u80FD\u5168\u8981

**\u811A\u672C\u7C7B\u578B\u4E0D\u7B49\u4E8E\u76EE\u7684**\uFF1A\u540C\u4E00\u79CD\u811A\u672C\u53EF\u4EE5\u670D\u52A1\u4E0D\u540C\u76EE\u7684\u2014\u2014\u6CDB\u77E5\u8BC6\uFF08\u5927\u4F17\u5165\u53E3\uFF09\u662F\u6D41\u91CF\u578B\uFF0C
\u4E13\u4E1A\u77E5\u8BC6\uFF08\u7CBE\u51C6\u4EBA\u7FA4\u7684\u96BE\u9898\uFF09\u662F\u53D8\u73B0\u578B\uFF1B\u8BB2\u81EA\u5DF1\u7684\u6210\u957F\u662F\u4EBA\u8BBE\u578B\uFF0C\u8BB2\u5E2E\u5BA2\u6237\u505A\u6210\u7684\u4E8B\u662F\u53D8\u73B0\u578B\u3002
\u5224\u65AD\u770B"\u8FD9\u6761\u89C6\u9891\u8981\u89C2\u4F17\u505A\u4EC0\u4E48"\uFF0C\u4E0D\u770B\u7528\u4E86\u54EA\u79CD\u811A\u672C\u3002

**\u7CFB\u5217\u4E5F\u4E00\u6837**\uFF1A\u4E00\u4E2A\u7CFB\u5217\u53EA\u62C5\u4E00\u4E2A\u4E3B\u76EE\u7684\uFF0C\u7CFB\u5217\u91CC\u6BCF\u4E00\u96C6\u7684\u76EE\u7684\u548C\u7CFB\u5217\u4E00\u81F4\u3002`;
function rolesGuide() {
  const block = (r) => {
    const s = ROLE_SPECS[r];
    return `#### ${r}\uFF1A${s.job}
- **\u62CD\u4EC0\u4E48\u65B9\u5411**\uFF1A${s.directions}
- **\u7528\u4EC0\u4E48\u811A\u672C**\uFF1A${s.scriptTypes}
- **\u811A\u672C\u7ED3\u6784**\uFF08\u6309\u5185\u5BB9\u6311\u4E00\u4E2A\uFF0C\u9AA8\u67B6\u7167\u7740\u8D70\uFF09\uFF1A
${s.structures.map((x) => `  - ${x}`).join("\n")}
- **\u600E\u4E48\u7B56\u5212**\uFF1A${s.planning}
- **\u8D77\u53F7\u6253\u6CD5\u91CC\u9002\u5408\u5B83\u7684**\uFF1A${TACTIC_ROLES[r].join("\u3001")}
- **\u770B\u4EC0\u4E48\u6570\u636E**\uFF1A${s.metrics}
- **\u7ED3\u5C3E\u884C\u52A8\u6307\u4EE4**\uFF1A${s.cta}
- **\u6700\u5E38\u89C1\u7684\u9519**\uFF1A${s.pitfalls}`;
  };
  return `### \u4E09\u79CD\u89C6\u9891\uFF1A\u6D41\u91CF\u578B / \u4EBA\u8BBE\u578B / \u53D8\u73B0\u578B

${ROLE_RULES}

${CONTENT_ROLE_LIST.map(block).join("\n\n")}`;
}
function roleInferRule(focus) {
  const line2 = (r) => {
    const s = ROLE_SPECS[r];
    if (focus === "hook") return `- **${r}**\uFF08${s.job}\uFF09\uFF1A${s.hook}`;
    if (focus === "shots") return `- **${r}**\uFF1A${s.shots}`;
    const names = s.structures.map((x) => x.split("\uFF1A")[0]).join(" / ");
    return `- **${r}**\uFF1A\u7ED3\u6784\u53EF\u53C2\u8003 ${names}\uFF1B\u7ED3\u5C3E\u52A8\u4F5C\u4EC5\u5728\u7528\u6237\u9700\u8981\u65F6\u53C2\u8003${s.cta}\uFF1B\u4E0D\u80FD\u56E0\u6CA1\u6709CTA\u6216\u4E0D\u5957\u9AA8\u67B6\u5C31\u5224\u4E0D\u5408\u683C`;
  };
  const head = focus === "review" ? "\u5148\u8BFB\u53D6\u7528\u6237\u660E\u786E\u76EE\u7684\u548C\u5E26\u5165\u7684\u8FDE\u7EED\u8BBE\u7F6E\uFF0C\u518D\u4ECE\u7A3F\u5B50\u6838\u5BF9\u662F\u5426\u4E00\u81F4\uFF1B\u672A\u6807\u76EE\u7684\u624D\u53C2\u8003\u6D41\u91CF\u578B\u3001\u4EBA\u8BBE\u578B\u3001\u53D8\u73B0\u578B\uFF0C\u6DF7\u5408\u76EE\u7684\u4FDD\u7559\uFF0C\u4E0D\u5F3A\u5236\u5F52\u7C7B\uFF1A" : "\u5DF2\u5E26\u5165\u7684\u7528\u6237\u76EE\u7684\u3001\u4EBA\u7FA4\u3001\u4E3B\u7EBF\u4F18\u5148\uFF0C\u4E0D\u4ECE\u4E3B\u9898\u91CD\u65B0\u5B9A\u76EE\u7684\uFF1B\u6CA1\u6709\u660E\u786E\u76EE\u7684\u65F6\u624D\u53C2\u8003\u4E0B\u5217\u7C7B\u578B\u9009\u62E9\u8868\u8FBE\uFF0C\u6DF7\u5408\u76EE\u7684\u5B8C\u6574\u4FDD\u7559\uFF1A";
  return `### \u{1F3AF} \u5148\u5224\u65AD\u8FD9\u6761\u89C6\u9891\u7684\u76EE\u7684

${head}
${CONTENT_ROLE_LIST.map(line2).join("\n")}`;
}

// .tmp/content-audit-production_20261008/lib/content-mix.ts
var PRESETS = [
  { id: "auto", label: "\u7CFB\u7EDF\u63A8\u8350", hint: "\u6309\u8D26\u53F7\u9636\u6BB5\u548C\u53D8\u73B0\u65B9\u5F0F\u81EA\u52A8\u5B9A" },
  { id: "traffic", label: "\u5F15\u6D41\u4F18\u5148", hint: "\u5148\u628A\u64AD\u653E\u548C\u7C89\u4E1D\u505A\u8D77\u6765", mix: { \u6D41\u91CF\u578B: 70, \u4EBA\u8BBE\u578B: 20, \u53D8\u73B0\u578B: 10 } },
  { id: "balanced", label: "\u5747\u8861", hint: "\u4E09\u79CD\u90FD\u8981\uFF0C\u6BD4\u8F83\u5E73\u5747", mix: { \u6D41\u91CF\u578B: 40, \u4EBA\u8BBE\u578B: 30, \u53D8\u73B0\u578B: 30 } },
  { id: "convert", label: "\u6210\u4EA4\u4F18\u5148", hint: "\u591A\u62CD\u80FD\u5E26\u6765\u54A8\u8BE2\u548C\u8BA2\u5355\u7684", mix: { \u6D41\u91CF\u578B: 25, \u4EBA\u8BBE\u578B: 20, \u53D8\u73B0\u578B: 55 } },
  { id: "custom", label: "\u81EA\u5B9A\u4E49", hint: "\u81EA\u5DF1\u62D6\u5230\u60F3\u8981\u7684\u6BD4\u4F8B" }
];
var STAGE_MIX = [
  { stage: "\u521A\u8D77\u53F7\uFF0C\u5B9A\u4F4D\u672A\u786E\u5B9A", mix: { \u6D41\u91CF\u578B: 60, \u4EBA\u8BBE\u578B: 25, \u53D8\u73B0\u578B: 15 }, why: "\u521A\u8D77\u53F7\u5148\u62FF\u7A33\u5B9A\u6D41\u91CF\u548C\u6B63\u53CD\u9988\uFF0C\u6D41\u91CF\u578B\u6700\u5927\uFF1B\u53D8\u73B0\u578B\u7B2C\u4E00\u5468\u5C31\u6709\uFF0C\u4F46\u53EA\u5360\u5C0F\u5934\uFF0C\u514D\u5F97\u50CF\u5E7F\u544A\u53F7" },
  { stage: "\u6709\u5B9A\u4F4D\uFF0C\u9700\u8981\u5185\u5BB9\u65B9\u5411", mix: { \u6D41\u91CF\u578B: 45, \u4EBA\u8BBE\u578B: 25, \u53D8\u73B0\u578B: 30 }, why: "\u6D41\u91CF\u5F00\u59CB\u7A33\u4E86\uFF0C\u53D8\u73B0\u578B\u6162\u6162\u957F\u4E0A\u6765\uFF0C\u6D41\u91CF\u578B\u4ECD\u7136\u662F\u4E3B\u529B" },
  { stage: "\u7A33\u5B9A\u8FD0\u8425\uFF0C\u9700\u8981\u65B0\u9009\u9898", mix: { \u6D41\u91CF\u578B: 30, \u4EBA\u8BBE\u578B: 20, \u53D8\u73B0\u578B: 50 }, why: "\u6D41\u91CF\u5DF2\u7ECF\u7A33\u5B9A\uFF0C\u6309\u4EE3\u8FD0\u8425 SOP \u7684\u6807\u51C6\u914D\u6BD4\uFF0C\u53D8\u73B0\u578B\u5360\u4E00\u534A" },
  { stage: "\u6210\u719F\u671F\uFF0C\u9700\u8981\u7A81\u7834", mix: { \u6D41\u91CF\u578B: 40, \u4EBA\u8BBE\u578B: 30, \u53D8\u73B0\u578B: 30 }, why: "\u6210\u719F\u671F\u8981\u7A81\u7834\uFF0C\u5F97\u91CD\u65B0\u62C9\u65B0\u4EBA\u3001\u52A0\u6DF1\u4EBA\u8BBE\uFF0C\u6D41\u91CF\u578B\u548C\u4EBA\u8BBE\u578B\u5F80\u56DE\u52A0" }
];
var FALLBACK = STAGE_MIX[1];
var asList = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string") : typeof v === "string" ? v.split(/[、,，]/).map((x) => x.trim()).filter(Boolean) : [];
function normalizeMix(m) {
  const raw = CONTENT_ROLE_LIST.map((r) => Math.max(0, Number(m[r]) || 0));
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) return { ...FALLBACK.mix };
  const scaled = raw.map((v) => Math.round(v / sum * 100 / 5) * 5);
  const diff = 100 - scaled.reduce((a, b) => a + b, 0);
  const top = scaled.indexOf(Math.max(...scaled));
  scaled[top] += diff;
  return Object.fromEntries(CONTENT_ROLE_LIST.map((r, i) => [r, scaled[i]]));
}
function shift(m, from, to, n, floor) {
  const move = Math.max(0, Math.min(n, m[from] - floor));
  return { ...m, [from]: m[from] - move, [to]: m[to] + move };
}
function recommendMix(profile, goal = "") {
  const p = profile;
  const stage = typeof p?.account_stage === "string" ? p.account_stage : "";
  const base2 = STAGE_MIX.find((s) => s.stage === stage) ?? FALLBACK;
  let mix = { ...base2.mix };
  const reasons = [stage ? `${stage}\uFF1A${base2.why}` : `\u6863\u6848\u6CA1\u586B\u8D26\u53F7\u9636\u6BB5\uFF0C\u6309\u8FC7\u6E21\u671F\u7ED9\uFF1A${FALLBACK.why}`];
  const money = asList(p?.monetization_model);
  if (money.length > 0 && money.every((x) => x === "\u6682\u4E0D\u8003\u8651")) {
    mix = shift(mix, "\u53D8\u73B0\u578B", "\u6D41\u91CF\u578B", 100, 10);
    reasons.push("\u53D8\u73B0\u65B9\u5F0F\u5199\u7684\u662F\u300C\u6682\u4E0D\u8003\u8651\u300D\uFF0C\u53D8\u73B0\u578B\u538B\u5230 10%");
  }
  if (/大流量|涨粉|曝光|影响力|做博主|上热门/.test(goal)) {
    mix = shift(mix, "\u53D8\u73B0\u578B", "\u6D41\u91CF\u578B", 10, 10);
    reasons.push("\u4F60\u8981\u7684\u662F\u6D41\u91CF\u548C\u66DD\u5149\uFF0C\u6D41\u91CF\u578B\u518D\u52A0 10%");
  } else if (/精准客户|只要成交|不在乎播放|多卖|带货|转化/.test(goal)) {
    mix = shift(mix, "\u6D41\u91CF\u578B", "\u53D8\u73B0\u578B", 10, 20);
    reasons.push("\u4F60\u8981\u7684\u662F\u6210\u4EA4\uFF0C\u53D8\u73B0\u578B\u518D\u52A0 10%");
  }
  return { mix: normalizeMix(mix), reason: reasons.join("\uFF1B") };
}
function readSetting(v) {
  if (!v || typeof v !== "object") return null;
  const s = v;
  if (!PRESETS.some((x) => x.id === s.preset)) return null;
  if (s.preset === "custom") return s.custom ? { preset: "custom", custom: normalizeMix(s.custom) } : null;
  return { preset: s.preset };
}
function mixOfSetting(s, p, goal) {
  if (s.preset === "custom" && s.custom) return { mix: normalizeMix(s.custom) };
  const preset = PRESETS.find((x) => x.id === s.preset);
  if (preset?.mix) return { mix: { ...preset.mix } };
  return recommendMix(p, goal);
}
var presetLabel = (s) => PRESETS.find((x) => x.id === s.preset)?.label ?? "\u7CFB\u7EDF\u63A8\u8350";
function resolveMix(profile, override, goal = "") {
  const p = profile;
  if (override) {
    const { mix: mix2, reason: reason2 } = mixOfSetting(override, p, goal);
    return { mix: mix2, source: "override", label: `\u8FD9\u6B21\u4E34\u65F6\u6539\u7684\xB7${presetLabel(override)}`, reason: reason2 };
  }
  const saved = readSetting(p?.content_mix);
  if (saved && saved.preset !== "auto") {
    return { mix: mixOfSetting(saved, p, goal).mix, source: "profile", label: `\u6863\u6848\u8BBE\u7F6E\xB7${presetLabel(saved)}` };
  }
  const { mix, reason } = recommendMix(p, goal);
  const stage = typeof p?.account_stage === "string" && p.account_stage ? p.account_stage.split("\uFF0C")[0] : "";
  return { mix, source: "auto", label: stage ? `\u7CFB\u7EDF\u63A8\u8350\uFF08${stage}\uFF09` : "\u7CFB\u7EDF\u63A8\u8350", reason };
}
var formatMix = (m) => CONTENT_ROLE_LIST.map((r) => `${r} ${m[r]}%`).join(" / ");
function mixContextLine(r) {
  return `- **\u5185\u5BB9\u914D\u6BD4**\uFF1A${formatMix(r.mix)}\uFF08${r.label}\uFF09\u3002\u51FA\u9009\u9898\u3001\u6392\u8BA1\u5212\u65F6\u6309\u8FD9\u4E2A\u6BD4\u4F8B\u5206`;
}

// .tmp/content-audit-production_20261008/lib/taboos.ts
var ANALYSIS = "(?!\u7684?(?:\u4F18\u52BF|\u77ED\u677F|\u95EE\u9898|\u96BE\u70B9|\u98CE\u9669|\u533A\u522B|\u597D\u5904|\u7279\u70B9|\u5356\u70B9|\u4EAE\u70B9|\u539F\u56E0|\u6311\u6218|\u969C\u788D|\u963B\u529B|\u53D8\u5316|\u6536\u83B7|\u611F\u53D7|\u56F0\u96BE|\u75DB\u70B9|\u673A\u4F1A|\u5DEE\u8DDD|\u4E0D\u540C|\u6559\u8BAD))";
var MEASURE = "(?!\u7684?(?:\u89D2\u5EA6|\u5C3A\u5BF8|\u627F\u91CD|\u529F\u7387|\u5BB9\u91CF|\u9650\u5EA6|\u7A0B\u5EA6|\u8303\u56F4|\u503C|\u901F\u5EA6|\u6E29\u5EA6|\u5F00\u53E3|\u5E45\u5EA6|\u957F\u5EA6|\u5BBD\u5EA6|\u9AD8\u5EA6|\u6DF1\u5EA6|\u91CD\u91CF|\u9762\u79EF|\u6863|\u706B|\u53F7|\u7801|\u97F3\u91CF|\u4EAE\u5EA6|\u529B\u5EA6|\u538B\u529B))";
var ABSOLUTE = `(?:\u5168\u7F51|\u5168\u57CE|\u5168\u56FD|\u5168\u5E02|\u53F2\u4E0A)?\u6700(?:\u6B63\u5B97|\u597D\u5403|\u597D(?![\u5148\u662F\u522B\u4E0D\u80FD\u7528\u5728\u8FD8\u6BCF\u627E\u628A\u8BA9\u7ED9\u4ECE\u518D\u591A\u5C11\u8D81\u63D0\u65E9\u8DDF])${ANALYSIS}|\u4FBF\u5B9C|\u4F4E\u4EF7|\u5B9E\u60E0|\u5212\u7B97|\u4E13\u4E1A|\u5730\u9053|\u5F3A|\u4F73|\u5927${ANALYSIS}${MEASURE}|\u5168|\u706B|\u9AD8\u7AEF|\u5B89\u5168|\u9760\u8C31)|\u5168\u7F51\u6700|\u5168\u57CE\u6700|\u7B2C\u4E00(?:\u5BB6|\u540D|\u54C1\u724C)|(?:\u5168\u56FD|\u5168\u5E02|\u5168\u57CE|\u5357\u4E50|\u53BF\u57CE)\u7B2C\u4E00|\u9876\u7EA7|\u6781\u81F4|\u56FD\u5BB6\u7EA7|\u72EC\u5BB6|\u552F\u4E00|\u53F2\u4E0A\u6700`;
var PLATFORM_TABOOS = [
  { id: "p-absolute", kind: "say", text: "\u7EDD\u5BF9\u5316\u7528\u8BED\uFF1A\u6700\u3001\u7B2C\u4E00\u3001\u9876\u7EA7\u3001\u6781\u81F4\u3001\u5168\u7F51\u6700\u4F4E\u3001\u56FD\u5BB6\u7EA7\u3001\u72EC\u5BB6\u3001\u552F\u4E00", why: "\u5E7F\u544A\u6CD5\u7EA2\u7EBF", instead: '\u8BF4\u5177\u4F53\u4E8B\u5B9E\uFF1A"\u5F00\u4E86 9 \u5E74""\u4E00\u5929\u5356 300 \u4E32"', words: ABSOLUTE },
  { id: "p-promise", kind: "say", text: "100% \u6709\u6548\u3001\u4FDD\u8BC1\u3001\u7EDD\u5BF9\u3001\u6C38\u4E45\u3001\u65E0\u526F\u4F5C\u7528", why: "\u865A\u5047\u627F\u8BFA", instead: '"\u5927\u591A\u6570\u5BA2\u4EBA\u53CD\u9988\u2026\u2026""\u6211\u4EEC\u7684\u505A\u6CD5\u662F\u2026\u2026"', words: "100%(?:\u6709\u6548|\u597D\u8BC4|\u6EE1\u610F)|\u4FDD\u8BC1(?:\u6709\u6548|\u6548\u679C|\u597D\u5403)|\u7EDD\u5BF9(?:\u6709\u6548|\u6B63\u5B97|\u4E0D)|\u6C38\u4E45(?:\u6709\u6548|\u4FDD\u6301)|\u65E0\u526F\u4F5C\u7528|\u96F6\u98CE\u9669" },
  { id: "p-lure", kind: "say", text: "\u70B9\u8D5E\u62BD\u5956\u3001\u8F6C\u53D1\u9001\u3001\u8BC4\u8BBA\u533A\u6263 1 \u9886\u798F\u5229\uFF08\u62FF\u5956\u52B1\u6362\u4E92\u52A8\uFF09", why: "\u8BF1\u5BFC\u4E92\u52A8\uFF0C\u5BB9\u6613\u9650\u6D41", instead: '\u7528\u5185\u5BB9\u672C\u8EAB\u5F15\u8BC4\u8BBA\uFF1A"\u4F60\u4EEC\u90A3\u8FB9\u4E5F\u8FD9\u6837\u5417\uFF1F"', words: "\u70B9\u8D5E(?:\u62BD\u5956|\u9001)|\u8F6C\u53D1(?:\u62BD\u5956|\u9001|\u6709\u793C)|(?:\u6263|\u6253)1(?:\u9886|\u9001|\u62BD)|\u8BC4\u8BBA(?:\u62BD\u5956|\u9001)" },
  { id: "p-offsite", kind: "say", text: "\u52A0\u5FAE\u4FE1\u3001\u52A0 V\u3001\u79C1\u4FE1\u53D1\u4F60\u4EF7\u683C\u3001\u4E3B\u9875\u6709\u8054\u7CFB\u65B9\u5F0F\uFF08\u53E3\u64AD\u6216\u5B57\u5E55\uFF09", why: "\u7AD9\u5916\u5BFC\u6D41\uFF0C\u6296\u97F3\u4E0A\u5BB9\u6613\u9650\u6D41", instead: "\u5F15\u5230\u5E73\u53F0\u5185\uFF1A\u56E2\u8D2D\u94FE\u63A5\u3001\u5230\u5E97\u5730\u5740\u3001\u8BC4\u8BBA\u533A\u56DE\u590D", words: "\u52A0(?:\u6211)?(?:\u5FAE\u4FE1|V\u4FE1|vx|VX|v\u4FE1|\u5A01\u4FE1)|\u79C1\u4FE1(?:\u53D1|\u7ED9)\u4F60(?:\u4EF7\u683C|\u62A5\u4EF7)|\u4E3B\u9875\u6709(?:\u8054\u7CFB\u65B9\u5F0F|\u5FAE\u4FE1)", closable: true },
  { id: "p-rival", kind: "say", text: '\u8D2C\u4F4E\u540C\u884C\u3001\u70B9\u540D\u7ADE\u54C1\uFF1A"\u9694\u58C1\u90A3\u5BB6\u90FD\u662F\u2026\u2026"', why: "\u4E0D\u6B63\u5F53\u7ADE\u4E89\uFF0C\u5BB9\u6613\u88AB\u4E3E\u62A5", instead: "\u53EA\u8BB2\u81EA\u5DF1\u600E\u4E48\u505A", words: "\u9694\u58C1(?:\u90A3\u5BB6|\u5E97)(?:\u90FD\u662F|\u5168\u662F|\u7528\u7684)|\u522B\u5BB6\u90FD\u662F|\u540C\u884C\u90FD\u662F(?:\u9A97|\u5751)" },
  { id: "p-authority", kind: "say", text: "\u5192\u7528\u6743\u5A01\uFF1A\u592E\u89C6\u63A8\u8350\u3001\u4E13\u5BB6\u8BA4\u8BC1\u3001\u653F\u5E9C\u6307\u5B9A\uFF08\u6CA1\u6709\u5C31\u4E0D\u8BF4\uFF09", why: "\u865A\u5047\u5BA3\u4F20", words: "\u592E\u89C6(?:\u63A8\u8350|\u62A5\u9053)|\u4E13\u5BB6(?:\u8BA4\u8BC1|\u63A8\u8350)|\u653F\u5E9C\u6307\u5B9A|\u5B98\u65B9\u6307\u5B9A" },
  { id: "p-privacy", kind: "shoot", text: "\u672A\u7ECF\u540C\u610F\u62CD\u987E\u5BA2\u3001\u8DEF\u4EBA\u6B63\u8138\uFF1B\u62CD\u672A\u6210\u5E74\u4EBA", why: "\u9690\u79C1\u548C\u672A\u6210\u5E74\u4EBA\u4FDD\u62A4", instead: "\u80CC\u5F71\u3001\u624B\u90E8\u3001\u6253\u7801" },
  { id: "p-politics", kind: "direction", text: "\u65F6\u653F\u3001\u5B97\u6559\u3001\u6C11\u65CF\u3001\u5730\u57DF\u6B67\u89C6\u7684\u8BDD\u9898", why: "\u901A\u7528\u7EA2\u7EBF" },
  { id: "p-fake", kind: "direction", text: "\u865A\u6784\u7ECF\u5386\u3001\u7F16\u9020\u6570\u636E\uFF08\u9500\u91CF\u3001\u64AD\u653E\u91CF\u3001\u5BA2\u6237\u6570\uFF09", why: "\u865A\u5047\u5BA3\u4F20", instead: "\u6CA1\u6709\u4F9D\u636E\u5199\u6210 X \u6216\u3010\u6362\u6210\u4F60\u7684\uFF1A\u2026\u2026\u3011" }
];
var INDUSTRIES = [
  {
    id: "food",
    name: "\u9910\u996E",
    values: ["\u7F8E\u98DF\u70F9\u996A", "\u9910\u996E", "\u98DF\u54C1\u996E\u6599"],
    keywords: /餐饮|餐厅|饭店|饭馆|面馆|火锅|烧烤|串串|小吃|奶茶|咖啡|烘焙|蛋糕|饮品|食堂|川菜|湘菜|粤菜|快餐/,
    items: [
      { id: "food-health", kind: "direction", text: "\u5403\u4E86\u80FD\u6CBB\u75C5\u3001\u517B\u751F\u3001\u51CF\u80A5\u3001\u58EE\u9633\u8FD9\u7C7B\u529F\u6548\u5411\u5185\u5BB9", why: "\u666E\u901A\u98DF\u54C1\u4E0D\u80FD\u5BA3\u4F20\u7597\u6548", instead: "\u53EA\u8BB2\u5473\u9053\u3001\u53E3\u611F\u3001\u5206\u91CF", words: "\u6CBB(?:\u75C5|\u80C3\u75C5|\u5931\u7720)|\u517B\u80C3|\u964D(?:\u4E09\u9AD8|\u8840\u538B|\u8840\u7CD6|\u8840\u8102)|\u6392\u6BD2|\u58EE\u9633|\u8865\u80BE|\u51CF\u80A5(?:\u795E\u5668|\u9910)" },
      { id: "food-dirty", kind: "direction", text: '\u66B4\u9732\u540E\u53A8\u536B\u751F\u95EE\u9898\u7684"\u771F\u5B9E\u63ED\u5E95"\uFF1A\u751F\u719F\u6DF7\u653E\u3001\u5458\u5DE5\u4E0D\u6234\u5E3D\u5B50\u3001\u5F92\u624B\u6293\u719F\u98DF', why: "\u4E00\u62CD\u5C31\u662F\u98DF\u5B89\u6295\u8BC9\u7D20\u6750", instead: "\u62CD\u4E4B\u524D\u5148\u6536\u62FE\uFF0C\u62CD\u5E72\u51C0\u7684\u64CD\u4F5C\u53F0" },
      { id: "food-wild", kind: "direction", text: "\u91CE\u751F\u52A8\u7269\u3001\u4FDD\u62A4\u52A8\u7269\u505A\u83DC", why: "\u8FDD\u6CD5" },
      { id: "food-drink", kind: "direction", text: "\u529D\u9152\u3001\u62FC\u9152\u3001\u559D\u9189\u7684\u753B\u9762\u548C\u8BDD\u9898", why: "\u5E73\u53F0\u9650\u5236\u996E\u9152\u5185\u5BB9", instead: "\u62CD\u6C1B\u56F4\u4E0D\u62CD\u559D" },
      { id: "food-natural", kind: "say", text: "\u96F6\u6DFB\u52A0\u3001\u7EAF\u5929\u7136\u3001\u65E0\u9632\u8150\u5242\uFF08\u6CA1\u6709\u68C0\u6D4B\u4F9D\u636E\uFF09", why: "\u865A\u5047\u5BA3\u4F20", instead: '\u8BF4\u770B\u5F97\u89C1\u7684\uFF1A"\u73B0\u5207\u73B0\u7A7F""\u5F53\u5929\u8FDB\u8D27"', words: "\u96F6\u6DFB\u52A0|\u7EAF\u5929\u7136|\u65E0\u9632\u8150\u5242|\u65E0\u4EFB\u4F55\u6DFB\u52A0" },
      { id: "food-price", kind: "say", text: "\u53E3\u64AD\u4EF7\u683C\u548C\u56E2\u8D2D\u9875\u5BF9\u4E0D\u4E0A", why: "\u4EF7\u683C\u6B3A\u8BC8\u6295\u8BC9", instead: "\u4EE5\u56E2\u8D2D\u9875\u4E3A\u51C6\uFF0C\u6216\u4E0D\u8BF4\u5177\u4F53\u4EF7" }
    ]
  },
  {
    id: "beauty",
    name: "\u7F8E\u5986\u62A4\u80A4",
    values: ["\u7F8E\u5986\u62A4\u80A4"],
    keywords: /美妆|护肤|化妆品|美容|美甲|美睫|皮肤管理/,
    items: [
      { id: "beauty-cure", kind: "direction", text: '\u6CBB\u7597\u76AE\u80A4\u75C5\u3001\u795B\u6591\u795B\u75D8\u7684"\u7597\u6548"\u5411\u5185\u5BB9\uFF08\u666E\u901A\u5316\u5986\u54C1\uFF09', why: "\u529F\u6548\u5BA3\u79F0\u8981\u5907\u6848\uFF0C\u666E\u901A\u5316\u5986\u54C1\u4E0D\u80FD\u8BF4", words: "\u795B\u6591|\u795B\u75D8|\u7F8E\u767D(?:\u6DE1\u6591)?|\u6297\u654F|\u4FEE\u590D(?:\u5C4F\u969C|\u53D7\u635F)|\u6CBB(?:\u75D8|\u6591|\u76AE\u80A4)" },
      { id: "beauty-medical", kind: "say", text: "\u533B\u5B66\u7EA7\u3001\u836F\u5986\u3001\u68B0\u5B57\u53F7\u5F53\u5316\u5986\u54C1\u5356", why: "\u6DF7\u6DC6\u6982\u5FF5", words: "\u533B\u5B66\u7EA7|\u836F\u5986|\u68B0\u5B57\u53F7" },
      { id: "beauty-compare", kind: "shoot", text: "\u5938\u5927\u7684\u524D\u540E\u5BF9\u6BD4\uFF08\u4FEE\u56FE\u3001\u4E0D\u540C\u5149\u7EBF\u89D2\u5EA6\uFF09", why: "\u865A\u5047\u5BA3\u4F20", instead: '\u540C\u5149\u540C\u89D2\u5EA6\uFF0C\u6807\u660E"\u4E2A\u4EBA\u6548\u679C"' },
      { id: "beauty-fast", kind: "say", text: "\u51E0\u5929\u89C1\u6548\u3001\u6C38\u4E45\u3001\u7ACB\u523B\u53D8\u767D", why: "\u865A\u5047\u627F\u8BFA", words: "[\u4E00\u4E8C\u4E09\u56DB\u4E94\u516D\u4E031-7]\u5929(?:\u89C1\u6548|\u53D8\u767D|\u795B)|\u7ACB\u523B\u53D8\u767D|\u4E00\u6B21\u89C1\u6548" }
    ]
  },
  {
    id: "medical",
    name: "\u533B\u7F8E / \u533B\u7597",
    values: [],
    keywords: /医美|整形|整容|诊所|医院|口腔|牙科|中医|理疗|针灸|推拿|植发/,
    items: [
      { id: "med-promise", kind: "direction", text: "\u4FDD\u8BC1\u6548\u679C\u3001\u65E0\u75DB\u3001\u96F6\u98CE\u9669\u3001\u5305\u6CBB\u7684\u627F\u8BFA\u5411\u5185\u5BB9", why: "\u533B\u7597\u5E7F\u544A\u7EA2\u7EBF", words: "\u65E0\u75DB|\u96F6\u98CE\u9669|\u5305\u6CBB|\u6839\u6CBB|\u5305\u6548\u679C|\u4FDD\u8BC1\u6548\u679C" },
      { id: "med-case", kind: "direction", text: "\u7528\u60A3\u8005\u672F\u524D\u672F\u540E\u5BF9\u6BD4\u3001\u60A3\u8005\u540D\u4E49\u505A\u8BC1\u660E", why: "\u533B\u7597\u5E7F\u544A\u4E0D\u80FD\u7528\u60A3\u8005\u540D\u4E49\u8BC1\u660E", instead: "\u8BB2\u6D41\u7A0B\u3001\u6CE8\u610F\u4E8B\u9879\u3001\u533B\u751F\u600E\u4E48\u5224\u65AD" },
      { id: "med-price", kind: "direction", text: '\u4F4E\u4EF7\u5F15\u6D41\u3001"9.9 \u5143\u505A\u2026\u2026"\u8FD9\u7C7B\u533B\u7597\u9879\u76EE\u4FC3\u9500', why: "\u533B\u7597\u670D\u52A1\u4F4E\u4EF7\u8BF1\u5BFC\u6613\u8FDD\u89C4" }
    ]
  },
  {
    id: "fitness",
    name: "\u5065\u8EAB\u8FD0\u52A8",
    values: ["\u5065\u8EAB\u8FD0\u52A8"],
    keywords: /健身|瑜伽|普拉提|减脂|私教|运动馆/,
    items: [
      { id: "fit-fast", kind: "direction", text: "X \u5929\u7626 X \u65A4\u3001\u8EBA\u7740\u7626\u3001\u4E0D\u8282\u98DF\u4E0D\u8FD0\u52A8\u4E5F\u80FD\u7626", why: "\u865A\u5047\u627F\u8BFA", instead: "\u8BB2\u65B9\u6CD5\u548C\u575A\u6301\u591A\u4E45\u7684\u771F\u5B9E\u8BB0\u5F55", words: "\\d+\u5929\u7626\\d*\u65A4?|\u8EBA\u7740(?:\u5C31)?\u7626|\u4E0D\u8282\u98DF(?:\u4E0D\u8FD0\u52A8)?(?:\u4E5F\u80FD|\u5C31\u80FD)?\u7626|\u6708\u7626\\d+" },
      { id: "fit-drug", kind: "direction", text: "\u63A8\u8350\u51CF\u80A5\u836F\u3001\u4EE3\u9910\u66FF\u4EE3\u6B63\u9910\u3001\u5904\u65B9\u836F", why: "\u533B\u7597\u98CE\u9669" },
      { id: "fit-cure", kind: "say", text: "\u6CBB\u7597\u8170\u690E\u3001\u6CBB\u9888\u690E\u75C5\uFF08\u975E\u533B\u7597\u673A\u6784\uFF09", why: "\u533B\u7597\u7528\u8BED", instead: '"\u7F13\u89E3\u4E45\u5750\u7684\u50F5\u786C\u611F"', words: "\u6CBB(?:\u7597)?(?:\u8170\u690E|\u9888\u690E|\u8170\u95F4\u76D8)" },
      { id: "fit-danger", kind: "shoot", text: "\u5371\u9669\u52A8\u4F5C\u4E0D\u52A0\u63D0\u793A", why: "\u5B89\u5168", instead: '\u52A0"\u91CF\u529B\u800C\u884C"\u63D0\u793A' }
    ]
  },
  {
    id: "edu",
    name: "\u6559\u80B2\u57F9\u8BAD",
    values: ["\u77E5\u8BC6\u6559\u80B2", "\u804C\u573A\u6210\u957F"],
    keywords: /教育|培训|辅导|课程|考研|考证|留学|编程|英语|托管/,
    items: [
      { id: "edu-promise", kind: "say", text: "\u4FDD\u8FC7\u3001\u5305\u5C31\u4E1A\u3001\u5305\u62FF\u8BC1\u3001100% \u63D0\u5206", why: "\u5E7F\u544A\u6CD5\u660E\u4EE4\u7981\u6B62\u7684\u6559\u80B2\u627F\u8BFA", instead: "\u8BF4\u5B66\u5458\u771F\u5B9E\u6848\u4F8B\uFF08\u5F81\u5F97\u540C\u610F\uFF09", words: "\u4FDD\u8FC7|\u5305(?:\u5C31\u4E1A|\u8FC7|\u62FF\u8BC1|\u5206\u914D)|(?:100%|\u767E\u5206\u767E)(?:\u63D0\u5206|\u901A\u8FC7|\u4E0A\u5CB8)|\u4E0D\u8FC7\u9000\u6B3E" },
      { id: "edu-rich", kind: "direction", text: "\u6708\u5165\u8FC7\u4E07\u3001\u8EBA\u8D5A\u3001\u526F\u4E1A\u66B4\u5BCC\u8FD9\u7C7B\u6536\u76CA\u627F\u8BFA\u5411\u5185\u5BB9", why: "\u5938\u5927\u6536\u76CA", words: "\u6708\u5165(?:\u8FC7\u4E07|\u5341\u4E07|\\d+\u4E07)|\u8EBA\u8D5A|\u66B4\u5BCC" },
      { id: "edu-anxiety", kind: "direction", text: '\u8D29\u5356\u7126\u8651\uFF1A"\u4E0D\u5B66\u5C31\u88AB\u6DD8\u6C70""\u5B69\u5B50\u8F93\u5728\u8D77\u8DD1\u7EBF"', why: "\u5E73\u53F0\u9650\u6D41", instead: "\u8BB2\u5177\u4F53\u95EE\u9898\u600E\u4E48\u89E3\u51B3", words: "\u8F93\u5728\u8D77\u8DD1\u7EBF|\u4E0D\u5B66\u5C31(?:\u88AB)?\u6DD8\u6C70" },
      { id: "edu-teacher", kind: "say", text: "\u540D\u5E08\u3001\u6E05\u5317\u540D\u5E08\uFF08\u6CA1\u6709\u4F9D\u636E\uFF09", why: "\u865A\u5047\u5BA3\u4F20", words: "\u6E05\u5317\u540D\u5E08|\u9876\u7EA7\u540D\u5E08|\u91D1\u724C\u540D\u5E08" }
    ]
  },
  {
    id: "baby",
    name: "\u6BCD\u5A74\u80B2\u513F",
    values: ["\u6BCD\u5A74\u80B2\u513F"],
    keywords: /母婴|育儿|奶粉|早教|月子|童装|婴/,
    items: [
      { id: "baby-effect", kind: "say", text: "\u589E\u5F3A\u514D\u75AB\u529B\u3001\u4FC3\u8FDB\u5927\u8111\u53D1\u80B2\uFF08\u666E\u901A\u98DF\u54C1\u3001\u7528\u54C1\uFF09", why: "\u529F\u6548\u5BA3\u79F0", words: "\u589E\u5F3A\u514D\u75AB(?:\u529B)?|\u4FC3\u8FDB(?:\u5927\u8111|\u667A\u529B)\u53D1\u80B2|\u957F\u9AD8\u795E\u5668" },
      { id: "baby-milk", kind: "say", text: "\u66FF\u4EE3\u6BCD\u4E73\u3001\u6BD4\u6BCD\u4E73\u597D", why: "\u8FDD\u89C4", words: "\u66FF\u4EE3\u6BCD\u4E73|\u6BD4\u6BCD\u4E73(?:\u8FD8)?\u597D|\u5AB2\u7F8E\u6BCD\u4E73" },
      { id: "baby-danger", kind: "shoot", text: "\u5B9D\u5B9D\u5371\u9669\u52A8\u4F5C\u3001\u88F8\u9732\u753B\u9762", why: "\u672A\u6210\u5E74\u4EBA\u4FDD\u62A4" },
      { id: "baby-scare", kind: "direction", text: '\u5413\u552C\u5BB6\u957F\uFF1A"\u4E0D\u7528\u8FD9\u4E2A\u5B69\u5B50\u5C31\u4F1A\u2026\u2026"', why: "\u8D29\u5356\u7126\u8651" }
    ]
  },
  {
    id: "home",
    name: "\u5BB6\u5C45\u88C5\u4FEE",
    values: ["\u5BB6\u5C45\u88C5\u4FEE"],
    keywords: /装修|家居|家具|建材|全屋定制|瓷砖|门窗|软装/,
    items: [
      { id: "home-promise", kind: "say", text: "\u96F6\u7532\u919B\u3001\u65E0\u6C61\u67D3\u3001\u6C38\u4E0D\u5F00\u88C2\u3001\u7EC8\u8EAB\u8D28\u4FDD\uFF08\u6CA1\u6709\u4F9D\u636E\uFF09", why: "\u865A\u5047\u627F\u8BFA", instead: "\u8BF4\u68C0\u6D4B\u62A5\u544A\u3001\u5B9E\u9645\u8D28\u4FDD\u671F", words: "\u96F6\u7532\u919B|\u65E0\u6C61\u67D3|\u6C38\u4E0D(?:\u5F00\u88C2|\u53D8\u5F62|\u892A\u8272)|\u7EC8\u8EAB\u8D28\u4FDD" },
      { id: "home-privacy", kind: "shoot", text: "\u62CD\u5BA2\u6237\u5BB6\u95E8\u724C\u3001\u5C0F\u533A\u540D\u3001\u5BB6\u91CC\u5168\u8C8C\uFF08\u672A\u540C\u610F\uFF09", why: "\u9690\u79C1", instead: "\u6253\u7801\u3001\u5F81\u5F97\u540C\u610F" },
      { id: "home-scare", kind: "direction", text: '"\u88C5\u4FEE\u516C\u53F8\u90FD\u662F\u9A97\u5B50"\u8FD9\u7C7B\u5168\u884C\u4E1A\u62B9\u9ED1', why: "\u6613\u88AB\u4E3E\u62A5\uFF0C\u4E5F\u4F24\u81EA\u5DF1", instead: "\u8BB2\u600E\u4E48\u907F\u5751" }
    ]
  },
  {
    id: "fashion",
    name: "\u65F6\u5C1A\u7A7F\u642D",
    values: ["\u65F6\u5C1A\u7A7F\u642D", "\u670D\u88C5\u914D\u9970"],
    keywords: /服装|女装|男装|穿搭|饰品|鞋包/,
    items: [
      { id: "fashion-fake", kind: "say", text: "\u5927\u724C\u540C\u6B3E\u3001\u539F\u5355\u3001\u5C3E\u5355\uFF08\u6D89\u5ACC\u4EFF\u5192\uFF09", why: "\u77E5\u8BC6\u4EA7\u6743", words: "\u5927\u724C\u540C\u6B3E|\u539F\u5355|\u5C3E\u5355|\u9AD8\u4EFF|1:1" },
      { id: "fashion-exaggerate", kind: "say", text: "\u663E\u7626 20 \u65A4\u3001\u7A7F\u4E0A\u79D2\u53D8\u2026\u2026\uFF08\u5938\u5927\uFF09", why: "\u5938\u5927\u5BA3\u4F20", instead: "\u8BF4\u7248\u578B\u548C\u9002\u5408\u7684\u8EAB\u6750", words: "\u663E\u7626\\d+\u65A4" },
      { id: "fashion-expose", kind: "direction", text: "\u64E6\u8FB9\u3001\u8FC7\u5EA6\u66B4\u9732\u7684\u7A7F\u642D\u65B9\u5411", why: "\u5E73\u53F0\u9650\u6D41" }
    ]
  },
  {
    id: "digital",
    name: "\u6570\u7801\u79D1\u6280",
    values: ["\u6570\u7801\u79D1\u6280", "\u6570\u7801\u5BB6\u7535"],
    keywords: /数码|手机|电脑|家电|维修/,
    items: [
      { id: "digital-rival", kind: "say", text: "\u79D2\u6740\u6240\u6709\u3001\u540A\u6253 XX\uFF08\u70B9\u540D\u54C1\u724C\uFF09", why: "\u8D2C\u4F4E\u7ADE\u54C1", instead: "\u8BB2\u53C2\u6570\u548C\u5B9E\u6D4B", words: "\u540A\u6253|\u79D2\u6740\u6240\u6709|\u5B8C\u7206" },
      { id: "digital-crack", kind: "direction", text: "\u7834\u89E3\u3001\u5237\u673A\u7ED5\u8FC7\u9650\u5236\u3001\u7FFB\u5899", why: "\u8FDD\u89C4" }
    ]
  },
  {
    id: "local",
    name: "\u672C\u5730\u670D\u52A1 / \u63A2\u5E97",
    values: ["\u65C5\u6E38\u63A2\u5E97", "\u672C\u5730\u670D\u52A1"],
    items: [
      { id: "local-ad", kind: "say", text: "\u5FC5\u5403\u3001\u5FC5\u53BB\u3001\u4E0D\u53BB\u540E\u6094\uFF08\u5546\u4E1A\u5408\u4F5C\u6CA1\u6807\u6CE8\uFF09", why: "\u5E7F\u544A\u672A\u6807\u8BC6", instead: "\u5408\u4F5C\u5185\u5BB9\u8981\u6807\u6CE8", words: "\u5FC5\u5403|\u5FC5\u53BB|\u4E0D\u53BB\u540E\u6094|\u4E0D\u6765\u540E\u6094" },
      { id: "local-staff", kind: "shoot", text: "\u672A\u7ECF\u540C\u610F\u62CD\u5E97\u5458\u3001\u987E\u5BA2\u6B63\u8138", why: "\u9690\u79C1", instead: "\u6253\u7801\u3001\u5F81\u5F97\u540C\u610F" },
      { id: "local-fake", kind: "direction", text: "\u6536\u4E86\u94B1\u5305\u88C5\u6210\u300C\u81EA\u8D39\u771F\u5B9E\u63A2\u5E97\u300D\uFF0C\u6216\u8005\u62CD\u540C\u884C\u5E97\u94FA\u7684\u5DEE\u8BC4\u3001\u66DD\u5149", why: "\u865A\u5047\u5BA3\u4F20\u3001\u4E0D\u6B63\u5F53\u7ADE\u4E89" }
    ]
  },
  {
    id: "emotion",
    name: "\u60C5\u611F\u751F\u6D3B",
    values: ["\u60C5\u611F\u751F\u6D3B"],
    items: [
      { id: "emo-pua", kind: "direction", text: "\u6559\u4EBA\u51FA\u8F68\u3001PUA \u8BDD\u672F\u3001\u64CD\u63A7\u5BF9\u65B9", why: "\u8FDD\u80CC\u516C\u5E8F\u826F\u4FD7" },
      { id: "emo-sexy", kind: "direction", text: "\u6027\u6697\u793A\u3001\u64E6\u8FB9", why: "\u5E73\u53F0\u7EA2\u7EBF" }
    ]
  },
  {
    id: "health-food",
    name: "\u4FDD\u5065\u54C1",
    values: [],
    keywords: /保健品|营养品|滋补|燕窝|阿胶|蛋白粉|益生菌/,
    items: [
      { id: "hf-cure", kind: "direction", text: "\u4FDD\u5065\u54C1\u80FD\u6CBB\u75C5\u3001\u66FF\u4EE3\u836F\u7269", why: "\u4FDD\u5065\u98DF\u54C1\u4E0D\u80FD\u5BA3\u79F0\u7597\u6548", words: "\u6CBB\u7597|\u6CBB\u6108|\u66FF\u4EE3\u836F\u7269|\u836F\u5230\u75C5\u9664|\u5305\u597D" },
      { id: "hf-old", kind: "direction", text: '\u9488\u5BF9\u8001\u4EBA\u7684"\u5305\u6CBB\u767E\u75C5"\u3001\u4F1A\u8BAE\u8425\u9500\u5F0F\u8BDD\u672F', why: "\u91CD\u70B9\u6253\u51FB\u5BF9\u8C61" }
    ]
  },
  {
    id: "finance",
    name: "\u91D1\u878D\u7406\u8D22",
    values: [],
    keywords: /理财|保险|贷款|基金|股票|信用卡|投资/,
    items: [
      { id: "fin-promise", kind: "say", text: "\u4FDD\u672C\u3001\u7A33\u8D5A\u3001\u9AD8\u6536\u76CA\u65E0\u98CE\u9669\u3001\u5E74\u5316 X% \u4FDD\u8BC1", why: "\u91D1\u878D\u5E7F\u544A\u7EA2\u7EBF", words: "\u4FDD\u672C|\u7A33\u8D5A|\u7A33\u8D5A\u4E0D\u8D54|\u65E0\u98CE\u9669|\u4FDD\u8BC1\u6536\u76CA|\u96F6\u98CE\u9669" },
      { id: "fin-loan", kind: "direction", text: '\u8BF1\u5BFC\u501F\u8D37\u3001"\u79D2\u6279""\u4E0D\u770B\u5F81\u4FE1"', why: "\u8FDD\u89C4", words: "\u79D2\u6279|\u4E0D\u770B\u5F81\u4FE1|\u9ED1\u6237\u53EF\u8D37" }
    ]
  },
  {
    id: "alcohol",
    name: "\u9152\u7C7B",
    values: [],
    keywords: /白酒|啤酒|红酒|酒馆|酒吧|精酿|酒坊/,
    items: [
      { id: "alc-drink", kind: "direction", text: "\u529D\u9152\u3001\u62FC\u9152\u3001\u559D\u9189\u3001\u672A\u6210\u5E74\u4EBA\u559D\u9152", why: "\u5E73\u53F0\u9650\u5236\u996E\u9152\u5185\u5BB9" },
      { id: "alc-health", kind: "say", text: "\u559D\u9152\u517B\u751F\u3001\u89E3\u4E4F\u3001\u52A9\u7720", why: "\u9152\u7C7B\u4E0D\u80FD\u5BA3\u4F20\u5065\u5EB7\u529F\u6548", words: "\u559D\u9152\u517B\u751F|\u517B\u751F\u9152|(?:\u52A9\u7720|\u89E3\u4E4F)(?:\u795E\u5668)?" }
    ]
  },
  {
    id: "pet",
    name: "\u5BA0\u7269",
    values: [],
    keywords: /宠物|猫粮|狗粮|猫咖|萌宠|铲屎|宠物店|犬舍|猫舍/,
    items: [
      { id: "pet-abuse", kind: "direction", text: "\u6574\u86CA\u3001\u5413\u552C\u3001\u8650\u5F85\u5BA0\u7269\u6765\u535A\u6D41\u91CF", why: "\u5E73\u53F0\u7EA2\u7EBF" },
      { id: "pet-cure", kind: "say", text: "\u5BA0\u7269\u7528\u54C1\u3001\u98DF\u54C1\u8BF4\u80FD\u6CBB\u75C5", why: "\u529F\u6548\u5BA3\u79F0", words: "\u6CBB(?:\u597D|\u6108)(?:\u732B|\u72D7)?(?:\u7663|\u75C5)" }
    ]
  },
  {
    id: "car",
    name: "\u6C7D\u8F66",
    values: [],
    keywords: /汽车|汽修|4S|二手车|车行|洗车|改装/,
    items: [
      { id: "car-danger", kind: "shoot", text: "\u5371\u9669\u9A7E\u9A76\u3001\u8D85\u901F\u3001\u4E0D\u7CFB\u5B89\u5168\u5E26\u3001\u8FB9\u5F00\u8FB9\u62CD", why: "\u5B89\u5168\u3001\u8FDD\u6CD5" },
      { id: "car-mod", kind: "direction", text: "\u8FDD\u89C4\u6539\u88C5\u6559\u7A0B\uFF08\u62C6\u4E09\u5143\u3001\u6539\u6392\u6C14\u70B8\u8857\uFF09", why: "\u8FDD\u6CD5" },
      { id: "car-used", kind: "say", text: '\u4E8C\u624B\u8F66"\u65E0\u4E8B\u6545""\u51C6\u65B0\u8F66"\uFF08\u6CA1\u6709\u68C0\u6D4B\u4F9D\u636E\uFF09', why: "\u865A\u5047\u5BA3\u4F20", words: "\u65E0\u4E8B\u6545|\u96F6\u4E8B\u6545|\u51C6\u65B0\u8F66" }
    ]
  },
  {
    id: "house",
    name: "\u623F\u4EA7",
    values: [],
    keywords: /房产|楼盘|中介|租房|二手房|置业/,
    items: [
      { id: "house-promise", kind: "say", text: '\u5347\u503C\u4FDD\u8BC1\u3001\u5B66\u533A\u627F\u8BFA\u3001"\u4E70\u5230\u5C31\u662F\u8D5A\u5230"', why: "\u623F\u5730\u4EA7\u5E7F\u544A\u4E0D\u80FD\u627F\u8BFA\u5347\u503C\u3001\u5B66\u533A", words: "(?:\u4FDD\u8BC1|\u7A33)\u5347\u503C|\u4E70\u5230\u5C31\u662F\u8D5A\u5230|\u5B66\u533A(?:\u623F)?\u4FDD\u8BC1|\u5305\u5B66\u4F4D" },
      { id: "house-panic", kind: "direction", text: '\u5236\u9020\u6050\u614C\uFF1A"\u518D\u4E0D\u4E70\u5C31\u4E70\u4E0D\u8D77\u4E86"', why: "\u8FDD\u89C4\u7092\u4F5C", words: "\u518D\u4E0D\u4E70\u5C31(?:\u4E70\u4E0D\u8D77|\u6CA1\u4E86)" }
    ]
  }
];
function readTabooSettings(v) {
  const o = v && typeof v === "object" ? v : {};
  const list = (x) => Array.isArray(x) ? x.filter((s) => typeof s === "string" && Boolean(s.trim())).map((s) => s.trim()) : [];
  return { disabled: list(o.disabled), extra: list(o.extra), added: list(o.added).filter((id) => INDUSTRIES.some((i) => i.id === id)), excluded: list(o.excluded) };
}
var asList2 = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string") : typeof v === "string" ? v.split(/[、,，]/).map((x) => x.trim()).filter(Boolean) : [];
function industriesOf(profile) {
  const p = profile ?? {};
  const values = [...asList2(p.account_track), ...asList2(p.product_category)];
  const text3 = [p.profile_name, ...values, p.content_themes].filter((x) => typeof x === "string").join(" ");
  const added = readTabooSettings(p.taboo_settings).added;
  return INDUSTRIES.filter((ind) => added.includes(ind.id) || ind.values.some((v) => values.includes(v)) || (ind.keywords ? ind.keywords.test(text3) : false));
}
function activeTaboos(profile) {
  const s = readTabooSettings(profile?.taboo_settings);
  const off = new Set(s.disabled);
  return {
    platform: PLATFORM_TABOOS.filter((t) => !(t.closable && off.has(t.id))),
    industries: industriesOf(profile).map((industry) => ({ industry, items: industry.items.filter((t) => !off.has(t.id)) })).filter((x) => x.items.length > 0),
    extra: s.extra
  };
}
function taboosPromptBlock(profile) {
  const a = activeTaboos(profile);
  const all = [...a.platform, ...a.industries.flatMap((x) => x.items)];
  const fmt = (t) => `- ${t.text}${t.instead ? `\uFF08\u6362\u6210\uFF1A${t.instead}\uFF09` : ""}`;
  const dirs = all.filter((t) => t.kind === "direction");
  const says = all.filter((t) => t.kind !== "direction");
  const names = a.industries.map((x) => x.industry.name).join("\u3001");
  const parts = [
    `#### \u{1F6AB} \u4E0D\u80FD\u62CD\u7684\u65B9\u5411${names ? `\uFF08\u5E73\u53F0\u7EA2\u7EBF + ${names}\u884C\u4E1A\uFF09` : "\uFF08\u5E73\u53F0\u7EA2\u7EBF\uFF09"}\u2014\u2014\u9009\u9898\u3001\u65B9\u5411\u3001\u793A\u4F8B\u4E00\u5F8B\u907F\u5F00`,
    ...dirs.map(fmt),
    "",
    "#### \u{1F6AB} \u4E0D\u80FD\u8BF4\u7684\u8BDD / \u4E0D\u80FD\u62CD\u7684\u753B\u9762",
    ...says.map(fmt)
  ];
  if (a.extra.length) parts.push("", "#### \u{1F6AB} \u8FD9\u4E2A\u53F7\u81EA\u5DF1\u8865\u5145\u7684", ...a.extra.map((x) => `- ${x}`));
  const excluded = readTabooSettings(profile?.taboo_settings).excluded;
  if (excluded.length) {
    parts.push(
      "",
      "#### \u{1F648} \u5EFA\u6863\u65F6\u7F16\u5BFC\u523B\u610F\u53BB\u6389\u7684\u4FE1\u606F\u2014\u2014\u5F53\u5B83\u4E0D\u5B58\u5728",
      ...excluded.map((x) => `- ${x}`),
      '\u8FD9\u4E9B\u662F\u524D\u91C7\u5F55\u97F3\u91CC\u6709\u3001\u4F46\u7F16\u5BFC\u5224\u65AD**\u6CA1\u7528\u6216\u4E0D\u60F3\u8981**\u7684\uFF1A\u4E0D\u5F15\u7528\u3001\u4E0D\u5F53\u4F9D\u636E\u3001\u4E0D\u636E\u6B64\u63A8\u65AD\u65B9\u5411\u548C\u4EBA\u8BBE\uFF0C\u4E5F\u4E0D\u8981\u63D0"\u867D\u7136\u4F60\u6709\xD7\xD7"\uFF1B',
      "\u6863\u6848\u5176\u4ED6\u680F\u3001\u5DF2\u6709\u7684\u5B9A\u4F4D\u6216\u7B80\u62A5\u91CC\u5982\u679C\u8FD8\u6B8B\u7559\u76F8\u5173\u8BF4\u6CD5\uFF0C**\u540C\u6837\u5FFD\u7565**\u3002"
    );
  }
  return parts.join("\n");
}

// .tmp/content-audit-production_20261008/lib/interview-exclusions.ts
var LABEL = new Map(PROFILE_FIELDS.map((f) => [f.key, f.label]));
var LABELS = new Set(PROFILE_FIELDS.map((f) => f.label));
var KIND = new Map(PROFILE_FIELDS.map((f) => [f.key, f.kind]));
function segmentsOf(text3) {
  const out = [];
  let depth = 0;
  let cur = "";
  for (const ch of text3) {
    if ("\uFF08(\u3010\u300C".includes(ch)) depth++;
    if ("\uFF09)\u3011\u300D".includes(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0 && "\u3001\uFF0C,\uFF1B;\n".includes(ch)) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
function grams(text3, n = 3) {
  const s = /* @__PURE__ */ new Set();
  for (const run of text3.match(/[\p{Script=Han}A-Za-z0-9]+/gu) ?? []) {
    for (let i = 0; i + n <= run.length; i++) {
      const g = run.slice(i, i + n);
      if ((g.match(/\p{Script=Han}/gu) ?? []).length >= 2) s.add(g);
    }
  }
  return s;
}
function exclusionGrams(excluded, stopText) {
  const stop = grams(stopText);
  return excluded.map((e) => {
    const m = e.match(/^([^：]{1,16})：/);
    const body = m && (m[1].endsWith("\u91CC\u7684") || LABELS.has(m[1])) ? e.slice(m[0].length) : e;
    const needles = /* @__PURE__ */ new Set();
    for (const piece of segmentsOf(body)) {
      const core = piece.replace(/^(?:不要|不提|不做|不拍|不说|别提|别拍|别)/, "").replace(/(?:相关的事|相关的|相关|的事|内容|这类)$/, "").trim();
      const han = (core.match(/\p{Script=Han}/gu) ?? []).length;
      if (han >= 2 && core.length <= 6) needles.add(core);
      for (const g of grams(core)) needles.add(g);
    }
    return [...needles].filter((x) => !stop.has(x));
  });
}
function hitsExclusion(segment, ex) {
  for (const list of ex) {
    const hit = list.find((x) => segment.includes(x));
    if (hit) return hit;
  }
  return void 0;
}
var UNTOUCHED = /* @__PURE__ */ new Set(["id", "user_id", "profile_name", "taboo_settings", "content_mix", "persona_facts", "interview_notes", "created_at", "updated_at", "content_restrictions", "avoid_content"]);
function scrubProfile(profile, excluded) {
  if (!profile || excluded.length === 0) return profile;
  const p = profile;
  const ex = exclusionGrams(excluded, String(p.profile_name ?? ""));
  const out = { ...p };
  for (const [k, v] of Object.entries(p)) {
    if (UNTOUCHED.has(k)) continue;
    if (Array.isArray(v)) out[k] = v.filter((x) => typeof x !== "string" || !hitsExclusion(x, ex));
    else if (typeof v === "string" && v.trim()) {
      const parts = k === "interview_highlights" ? v.split("\n") : segmentsOf(v);
      const kept = parts.filter((s) => !hitsExclusion(s, ex));
      if (kept.length !== parts.length) out[k] = kept.join(k === "interview_highlights" ? "\n" : "\u3001");
    }
  }
  return out;
}

// .tmp/content-audit-production_20261008/lib/persona-facts.ts
var PERSONA_FIELDS = [
  { key: "host", label: "\u51FA\u955C\u4EBA\u662F\u8C01", placeholder: "\u4F8B\u5982\uFF1A\u4E3B\u53A8\u8001\u738B\u3001\u8001\u677F\u5A18\u5C0F\u82B3" },
  { key: "role", label: "\u548C\u5E97\u7684\u5173\u7CFB", placeholder: "\u4F8B\u5982\uFF1A\u8001\u677F / \u4E3B\u53A8 / \u5E97\u5458 / \u7F16\u5BFC\u672C\u4EBA" },
  { key: "origin", label: "\u4ECE\u54EA\u6765", placeholder: "\u4F8B\u5982\uFF1A\u6210\u90FD\u4EBA" },
  { key: "yearsInTrade", label: "\u5E72\u8FD9\u884C\u51E0\u5E74", placeholder: "\u4F8B\u5982\uFF1A\u505A\u5DDD\u83DC 9 \u5E74" },
  { key: "yearsLocal", label: "\u5728\u672C\u5730\u591A\u4E45", placeholder: "\u4F8B\u5982\uFF1A\u6765\u5357\u4E50\u534A\u5E74" },
  { key: "mainProducts", label: "\u4E3B\u5356\u4EC0\u4E48", placeholder: "\u4F8B\u5982\uFF1A\u5DDD\u5473\u4E32\u4E32\u706B\u9505\u3001\u5DDD\u5473\u70E7\u70E4\u3001\u5DDD\u83DC" },
  { key: "signature", label: "\u62DB\u724C / \u7279\u8272", placeholder: "\u4F8B\u5982\uFF1A\u4E00\u5143\u706B\u9505" },
  { key: "story", label: "\u4E00\u53E5\u8BDD\u7ECF\u5386", placeholder: "\u4F8B\u5982\uFF1A\u5728\u6210\u90FD\u505A\u4E86 9 \u5E74\u5DDD\u83DC\uFF0C\u4ECA\u5E74\u6765\u5357\u4E50\u8DDF\u670B\u53CB\u5408\u4F19\u6446\u5730\u644A", multiline: true },
  { key: "others", label: "\u5176\u4ED6\u786C\u4E8B\u5B9E\uFF08\u4E00\u884C\u4E00\u6761\uFF09", placeholder: "\u4F8B\u5982\uFF1A\n\u6BCF\u5929\u4E0B\u5348 4 \u70B9\u51FA\u644A\n\u4EBA\u5747 30-50 \u5143", multiline: true }
];
var KEYS = PERSONA_FIELDS.map((f) => f.key);
function readPersonaFacts(v) {
  const o = v && typeof v === "object" ? v : {};
  const out = {};
  for (const k of KEYS) {
    const s = typeof o[k] === "string" ? o[k].trim().slice(0, k === "others" || k === "story" ? 600 : 120) : "";
    if (s) out[k] = s;
  }
  return out;
}
function personaFactsBlock(v) {
  const f = readPersonaFacts(v);
  const rows = PERSONA_FIELDS.filter((x) => f[x.key]).map((x) => {
    const val = f[x.key];
    return x.key === "others" ? `- **${x.label.replace(/（.*）/, "")}**\uFF1A
${val.split("\n").map((l) => `  - ${l.trim()}`).filter((l) => l.trim() !== "-").join("\n")}` : `- **${x.label}**\uFF1A${val}`;
  });
  if (rows.length === 0) return "";
  return [
    "### \u{1FAAA} \u4EBA\u8BBE\u4E8B\u5B9E\u5361\uFF08\u6700\u786C\u7684\u4E8B\u5B9E\uFF0C\u4EE5\u5B83\u4E3A\u51C6\uFF09",
    "",
    ...rows,
    "",
    "\u8FD9\u662F\u7F16\u5BFC\u786E\u8BA4\u8FC7\u7684\u4E8B\u5B9E\uFF1A**\u548C\u6863\u6848\u5176\u4ED6\u680F\u3001\u524D\u91C7\u8981\u70B9\u3001\u5DF2\u6709\u7684\u5B9A\u4F4D\u6216\u7B80\u62A5\u5BF9\u4E0D\u4E0A\u65F6\uFF0C\u4E00\u5F8B\u4EE5\u8FD9\u91CC\u4E3A\u51C6**\uFF1B",
    "\u5199\u4EBA\u8BBE\u3001\u7ECF\u5386\u3001\u5E74\u9650\u3001\u7C4D\u8D2F\u3001\u5728\u5356\u4EC0\u4E48\u65F6\u53EA\u7528\u8FD9\u91CC\u7684\u8BF4\u6CD5\uFF0C\u4E0D\u6539\u5199\u3001\u4E0D\u5938\u5927\uFF1B\u8FD9\u91CC\u6CA1\u5199\u7684\u7ECF\u5386\u548C\u6570\u5B57\u4E0D\u8981\u81EA\u5DF1\u7F16\uFF08\u7528 X \u6216\u3010\u6362\u6210\u4F60\u7684\uFF1A\u2026\u2026\u3011\uFF09\u3002"
  ].join("\n");
}

// .tmp/content-audit-production_20261008/lib/performance.ts
var METRIC_FIELDS = [
  { key: "views", label: "\u64AD\u653E", max: 1e9 },
  { key: "completion", label: "\u5B8C\u64AD\u7387", unit: "%", max: 100 },
  { key: "likes", label: "\u70B9\u8D5E", max: 1e8 },
  { key: "comments", label: "\u8BC4\u8BBA", max: 1e8 },
  { key: "shares", label: "\u8F6C\u53D1", max: 1e8 },
  { key: "follows", label: "\u6DA8\u7C89", max: 1e8 },
  { key: "inquiries", label: "\u54A8\u8BE2", max: 1e7 },
  { key: "deals", label: "\u6210\u4EA4", max: 1e7 },
  { key: "retention3s", label: "\u4E09\u79D2\u7559\u5B58\u7387", unit: "%", max: 100 },
  { key: "observationHours", label: "\u53D1\u5E03\u540E\u89C2\u5BDF\u65F6\u957F", unit: "\u5C0F\u65F6", max: 8760 }
];
function metricsLine(m) {
  if (!m) return "";
  const fmt = (n) => n >= 1e4 ? `${(n / 1e4).toFixed(n >= 1e5 ? 1 : 2).replace(/\.?0+$/, "")}\u4E07` : String(n);
  return METRIC_FIELDS.filter((f) => typeof m[f.key] === "number").map((f) => `${f.label} ${f.unit ? m[f.key] : fmt(m[f.key])}${f.unit ?? ""}`).join(" \xB7 ");
}
var MIN_SAMPLE = 3;
function performancePromptBlock(s) {
  if (!s || s.count === 0) return "";
  const g = (x) => `- ${x.name}\uFF08${x.n} \u6761\uFF09\uFF1A\u5E73\u5747\u64AD\u653E ${x.avgViews === null ? "\u2014" : Math.round(x.avgViews)}${x.avgCompletion === null ? "" : `\u3001\u5B8C\u64AD ${Math.round(x.avgCompletion)}%`}${x.follows ? `\u3001\u6DA8\u7C89 ${x.follows}` : ""}${x.inquiries ? `\u3001\u54A8\u8BE2 ${x.inquiries}` : ""}${x.deals ? `\u3001\u6210\u4EA4 ${x.deals}` : ""}${x.rates?.inquiries === void 0 ? "" : `\u3001\u6BCF\u5343\u64AD\u653E\u54A8\u8BE2 ${x.rates.inquiries}`}${x.rates?.follows === void 0 ? "" : `\u3001\u6BCF\u5343\u64AD\u653E\u6DA8\u7C89 ${x.rates.follows}`}${x.rates?.deals === void 0 ? "" : `\u3001\u6BCF\u5343\u64AD\u653E\u6210\u4EA4 ${x.rates.deals}`}`;
  const parts = [`### \u{1F4C8} \u8FD9\u4E2A\u53F7\u53D1\u51FA\u53BB\u7684\u771F\u5B9E\u6570\u636E\uFF08${s.count} \u6761\u5F55\u4E86\u6570\u636E\uFF09`, ""];
  if (s.byPurpose.length) parts.push("\u6309\u4E09\u79CD\u89C6\u9891\uFF1A", ...s.byPurpose.map(g), "");
  if (s.byTactic.length) parts.push("\u6309\u62CD\u6CD5\uFF1A", ...s.byTactic.slice(0, 6).map(g), "");
  if (s.byCohort?.length) parts.push("\u540C\u76EE\u7684\u3001\u540C\u5E73\u53F0\u3001\u76F8\u8FD1\u89C2\u5BDF\u65F6\u95F4\u3001\u540C\u6295\u653E\u60C5\u51B5\uFF1A", ...s.byCohort.slice(0, 8).map(g), "\u542B\u6295\u653E\u7684\u7D20\u6750\u8FD8\u9700\u8003\u8651\u6295\u653E\u91D1\u989D\u548C\u4EBA\u7FA4\u5DEE\u5F02\u3002", "");
  if (s.comparisonScope) parts.push(`\u4EE5\u4E0B\u6392\u5E8F\u53EA\u53C2\u8003\u300C${s.comparisonScope}\u300D\uFF0C\u4E0D\u662F\u5168\u8D26\u53F7\u6392\u540D\uFF0C\u4E5F\u4E0D\u662F\u5DF2\u9A8C\u8BC1\u7ED3\u8BBA\u3002`);
  if (s.best.length) parts.push(`\u672C\u7EC4\u8F83\u9AD8\u53C2\u8003\u9879\uFF1A${s.best.map((r) => `\u300C${r.title}\u300D\uFF08${metricsLine(r.metrics)}\uFF09`).join("\uFF1B")}`);
  if (s.worst.length) parts.push(`\u672C\u7EC4\u5F85\u590D\u76D8\u9879\uFF1A${s.worst.map((r) => `\u300C${r.title}\u300D\uFF08${metricsLine(r.metrics)}\uFF09`).join("\uFF1B")}`);
  if (s.insights.length) parts.push("", ...s.insights.map((x) => `- ${x}`));
  parts.push(
    "",
    s.count < MIN_SAMPLE ? "\u26A0\uFE0F \u6837\u672C\u8FD8\u5C11\uFF0C\u4E0A\u9762\u53EA\u5F53\u53C2\u8003\uFF0C\u4E0D\u8981\u636E\u6B64\u4E0B\u7ED3\u8BBA\u6216\u63A8\u7FFB\u5B9A\u4F4D\u3002" : "\u6309\u521B\u4F5C\u76EE\u6807\u63D0\u51FA\u4E0B\u4E00\u8F6E\u5BF9\u7167\u8BD5\u9A8C\uFF0C\u4E0D\u56E0\u64AD\u653E\u4F4E\u5C31\u653E\u5F03\u6709\u54A8\u8BE2\u7684\u4F5C\u54C1\uFF0C\u4E0D\u628A\u76F8\u5173\u6027\u5199\u6210\u56E0\u679C\u6216\u5DF2\u9A8C\u8BC1\u6709\u6548\u3002\u6BCF\u5343\u64AD\u653E\u6307\u6807\u7528\u4E8E\u7EDF\u4E00\u5206\u6BCD\uFF0C\u7F3A\u5931\u9879\u4E0D\u7B49\u4E8E\u96F6\u3002\u6CA1\u6709\u4E09\u79D2\u7559\u5B58\u6570\u636E\uFF0C\u4E0D\u80FD\u65AD\u8A00\u5F00\u5934\u6CA1\u7559\u4F4F\u4EBA\u3002"
  );
  return parts.join("\n");
}

// .tmp/content-audit-production_20261008/lib/creator-presets.ts
var PRESET_BOARDS = /* @__PURE__ */ new Set(["script", "review", "title", "growth", "remix", "storyboard", "freeChat"]);
var EXAMPLE_IN_PROMPT = 600;
function presetPromptBlock(p) {
  if (!p) return "";
  const lines = [`## \u270D\uFE0F \u8FD9\u4E2A\u8D26\u53F7\u8BA4\u53EF\u7684\u5199\u6CD5\uFF08\u98CE\u683C\u9884\u8BBE\uFF1A${p.name}\uFF09`, ""];
  if (p.style) lines.push(`- **\u8868\u8FBE\u98CE\u683C**\uFF1A${p.style}`);
  if (p.structure) lines.push(`- **\u7ED3\u6784**\uFF1A${p.structure}`);
  if (p.examples.length) {
    lines.push("", "\u4E0B\u9762\u662F\u7528\u6237\u8BA4\u53EF\u7684\u597D\u7A3F\uFF0C**\u53EA\u5B66\u8BED\u6C14\u3001\u8282\u594F\u548C\u7ED3\u6784**\uFF1A");
    p.examples.forEach((e, i) => {
      const body = e.content.length > EXAMPLE_IN_PROMPT ? `${e.content.slice(0, EXAMPLE_IN_PROMPT)}\u2026` : e.content;
      lines.push("", `### \u793A\u4F8B${i + 1}\uFF1A${e.title}`, body);
    });
  }
  lines.push("", "\u26A0\uFE0F \u793A\u4F8B\u91CC\u7684\u5E97\u540D\u3001\u4EF7\u683C\u3001\u6570\u5B57\u3001\u7ECF\u5386\u3001\u5730\u70B9**\u4E0D\u80FD\u642C\u8FDB\u65B0\u7A3F**\uFF1B\u4E8B\u5B9E\u4EE5\u4E0A\u9762\u7684\u8D26\u53F7\u80CC\u666F\u548C\u8FD9\u6B21\u7684\u7D20\u6750\u4E3A\u51C6\u3002\u98CE\u683C\u9884\u8BBE\u548C\u672C\u6B21\u8981\u6C42\u51B2\u7A81\u65F6\uFF0C\u4EE5\u672C\u6B21\u8981\u6C42\u4E3A\u51C6\u3002");
  return lines.join("\n");
}

// .tmp/content-audit-production_20261008/lib/preferences.ts
var PREFERENCE_CATEGORIES = [
  { id: "tone", label: "\u53E3\u543B\u7528\u8BCD" },
  { id: "opening", label: "\u5F00\u5934\u4E60\u60EF" },
  { id: "structure", label: "\u7ED3\u6784\u4E0E\u957F\u5EA6" },
  { id: "content", label: "\u5185\u5BB9\u53D6\u5411" }
];
var CATEGORY_IDS = new Set(PREFERENCE_CATEGORIES.map((c) => c.id));
var PROMPT_MAX = 600;
var PREFERENCE_BOARDS = /* @__PURE__ */ new Set(["topic", "script", "storyboard", "review", "title", "growth", "remix", "freeChat"]);
function preferencePromptBlock(items) {
  const active = (items ?? []).filter((i) => i.status === "active");
  if (!active.length) return "";
  const lines = [];
  let len = 0;
  for (const c of PREFERENCE_CATEGORIES) {
    for (const i of active.filter((x) => x.category === c.id)) {
      const line2 = `- ${c.label}\uFF1A${i.text}`;
      if (len + line2.length > PROMPT_MAX) break;
      lines.push(line2);
      len += line2.length;
    }
  }
  return [
    `## \u{1F9E0} \u8FD9\u4E2A\u53F7\u7684\u521B\u4F5C\u504F\u597D\uFF08\u4ECE\u4ED6\u7684\u4FEE\u6539\u3001\u6536\u85CF\u548C\u53D1\u5E03\u91CC\u5B66\u5230\u7684\uFF0C\u4ED6\u770B\u8FC7\u3001\u53EF\u4EE5\u6539\uFF09`,
    "",
    ...lines,
    "",
    "\u26A0\uFE0F \u8FD9\u4E9B\u662F\u5199\u6CD5\u4E60\u60EF\uFF0C\u7167\u7740\u5199\uFF1B\u548C\u4E0A\u9762\u7684\u4EBA\u8BBE\u4E8B\u5B9E\u5361\u3001\u7981\u5FCC\u3001\u8D26\u53F7\u6863\u6848\u3001\u98CE\u683C\u9884\u8BBE\u6216\u8FD9\u6B21\u7684\u8981\u6C42\u51B2\u7A81\u65F6\uFF0C\u4EE5\u5B83\u4EEC\u4E3A\u51C6\u3002"
  ].join("\n");
}

// .tmp/content-audit-production_20261008/lib/output-rules.ts
var PRIORITY_ORDER = "\u4E8B\u5B9E\u4E0E\u5B89\u5168\u8FB9\u754C\uFF08\u4EBA\u8BBE\u4E8B\u5B9E\u5361\u3001\u7981\u5FCC\u3001\u5E73\u53F0\u89C4\u5219\uFF09 > \u7528\u6237\u8FD9\u6B21\u7684\u660E\u786E\u8981\u6C42 > \u8FD9\u6761\u5185\u5BB9\u7684\u521B\u4F5C\u76EE\u7684 > \u6A21\u677F\u548C\u6807\u51C6";
var OUTPUT_RULE_BOARDS = /* @__PURE__ */ new Set(["topic", "script", "storyboard", "review", "title", "growth", "remix", "freeChat", "direction"]);
var FACT_RULES = [
  "\u4EF7\u683C\u3001\u767E\u5206\u6BD4\u3001\u9500\u91CF\u3001\u5E74\u9650\u3001\u5206\u5E97\u6570\u3001\u83B7\u5956\u3001\u987E\u5BA2\u7ECF\u5386\u2014\u2014\u8D44\u6599\u91CC\u6CA1\u6709\u7684\u4E00\u5F8B\u4E0D\u5199\uFF1B\u9700\u8981\u5177\u4F53\u611F\u65F6\uFF0C\u7528\u4E0D\u5E26\u6570\u5B57\u7684\u8BF4\u6CD5\uFF08\u300C90% \u7684\u4EBA\u300D\u4E0D\u884C\uFF0C\u300C\u4E0D\u5C11\u4EBA\u300D\u53EF\u4EE5\uFF1B\u300C\u4EBA\u5747 68 \u5143\u300D\u4E0D\u884C\uFF0C\u300C\u4EF7\u683C\u5F88\u4EB2\u6C11\u300D\u53EF\u4EE5\uFF09\u3002",
  "\u53EF\u4EE5\u5199\u865A\u6784\u7684\u793A\u4F8B\u5E2E\u52A9\u7406\u89E3\uFF0C\u4F46\u5FC5\u987B\u6807\u3010\u793A\u4F8B\u3011\uFF0C\u4E0D\u80FD\u5199\u6210\u300C\u6709\u4F4D\u987E\u5BA2\u8BF4\u2026\u2026\u300D\u8FD9\u79CD\u771F\u5B9E\u89C1\u8BC1\u3002",
  "\u9001\u4EC0\u4E48\u3001\u5305\u4EC0\u4E48\u3001\u4FDD\u8BC1\u4EC0\u4E48\u3001\u6253\u51E0\u6298\u2014\u2014\u8001\u677F\u6CA1\u8BF4\u8FC7\u7684\u7ECF\u8425\u627F\u8BFA\u4E0D\u80FD\u66FF\u4ED6\u7B54\u5E94\u3002",
  "\u771F\u60F3\u5199\u4E00\u4E2A\u5177\u4F53\u6570\u5B57\u53C8\u6CA1\u6709\u8D44\u6599\uFF0C\u7528\u3010\u5F85\u786E\u8BA4\uFF1Axx\u3011\u5360\u4F4D\uFF0C\u8BA9\u7528\u6237\u81EA\u5DF1\u586B\u3002",
  "\u4E0D\u8981\u5199\u300C\u81EA\u68C0\u901A\u8FC7\u300D\u300C\u65E0\u7F16\u9020\u300D\u300C\u6570\u636E\u771F\u5B9E\u300D\u8FD9\u7C7B\u81EA\u6211\u8BA4\u8BC1\uFF0C\u7CFB\u7EDF\u4F1A\u5355\u72EC\u6838\u5BF9\u3002"
];
function outputRulesBlock() {
  return ["## \u{1F9ED} \u5199\u4F5C\u5E95\u7EBF\uFF08\u6BCF\u6761\u90FD\u8981\u9075\u5B88\uFF09", "", `- **\u4F18\u5148\u7EA7**\uFF1A${PRIORITY_ORDER}\u3002\u7528\u6237\u7684\u660E\u786E\u8981\u6C42\u54EA\u6015\u53EA\u6709\u4E00\u53E5\uFF08\u300C\u53EA\u6362\u5F00\u5934\u300D\u300C\u522B\u63D0\u4EF7\u683C\u300D\uFF09\uFF0C\u4E5F\u6392\u5728\u6A21\u677F\u524D\u9762\u3002`, ...FACT_RULES.map((r) => `- ${r}`)].join("\n");
}

// .tmp/content-audit-production_20261008/lib/creator-context.ts
var PERFORMANCE_BOARDS = /* @__PURE__ */ new Set(["topic", "direction", "growth", "freeChat"]);
function briefOlderThanProfile(ctx) {
  return !!ctx.brief && briefFactsChanged(ctx.briefFacts, ctx.profile);
}
function text2(v, maxLen = 300) {
  if (v == null) return "";
  const s = Array.isArray(v) ? v.filter(Boolean).join("\u3001") : String(v);
  const t = s.trim();
  if (!t) return "";
  return t.length > maxLen ? t.slice(0, maxLen) + "\u2026" : t;
}
function line(label, value, maxLen = 300) {
  const t = text2(value, maxLen);
  return t ? `- **${label}**\uFF1A${t}` : null;
}
var join = (lines) => lines.filter(Boolean).join("\n");
function describeShootingSetup(p) {
  if (!p) return "";
  const rows = join([
    line("\u53EF\u7528\u8BBE\u5907", p.equipment),
    line("\u56E2\u961F\u89C4\u6A21", p.team_structure),
    line("\u5E38\u7528\u573A\u5730", p.shooting_location),
    line("\u526A\u8F91\u80FD\u529B", p.editing_capability),
    line("\u5355\u6761\u9884\u7B97", p.budget_per_video),
    line("\u60EF\u7528\u65F6\u957F", p.video_duration)
  ]);
  if (!rows) return "";
  return `## \u{1F3A5} \u8FD9\u4E2A\u8D26\u53F7\u7684\u771F\u5B9E\u62CD\u6444\u6761\u4EF6

${rows}

**\u6309\u8FD9\u4E9B\u6761\u4EF6\u8BBE\u8BA1\u5206\u955C**\uFF1A\u6709\u7A33\u5B9A\u5668\u624D\u5B89\u6392\u8FD0\u52A8\u955C\u5934\uFF0C\u6709\u706F\u5149\u624D\u8BBE\u8BA1\u5149\u4F4D\uFF0C
\u56E2\u961F\u53EA\u6709\u4E00\u4E2A\u4EBA\u5C31\u4E0D\u8981\u51FA\u73B0\u9700\u8981\u7B2C\u4E8C\u673A\u4F4D\u540C\u65F6\u62CD\u7684\u955C\u5934\u3002
\u6761\u4EF6\u6CA1\u5199\u5230\u7684\u6309\u6700\u4FDD\u5B88\u7684\u60C5\u51B5\u5904\u7406\uFF08\u624B\u673A\u3001\u5355\u4EBA\u3001\u81EA\u7136\u5149\uFF09\u3002`;
}
function describeAudience(p, detail) {
  const base2 = join([
    line("\u4EBA\u7FA4", [text2(p.target_age), text2(p.target_gender), text2(p.target_occupation)].filter(Boolean).join(" \xB7 ")),
    line("\u5730\u57DF", p.target_region)
  ]);
  if (detail === "brief") return base2;
  return join([
    base2,
    line("\u771F\u5B9E\u75DB\u70B9", p.target_pain_points, 500),
    line("\u771F\u6B63\u9700\u6C42", p.target_needs, 500),
    line("\u7C89\u4E1D\u5E38\u95EE", p.fan_common_questions, 400)
  ]);
}
function describeRestrictions(p) {
  const rows = join([
    line("\u7EDD\u5BF9\u4E0D\u80FD\u8BF4", p.content_restrictions, 500),
    line("\u907F\u514D\u7684\u5185\u5BB9", p.avoid_content, 300)
  ]);
  return `### \u26D4 \u786C\u6027\u7981\u5FCC\uFF08\u8FDD\u53CD\u5373\u4E0D\u53EF\u7528\uFF09

${rows ? `${rows}

` : ""}${taboosPromptBlock(p)}`;
}
function buildContextBlock(ctx, module2) {
  const p = ctx.profile ? scrubProfile(ctx.profile, readTabooSettings(ctx.profile.taboo_settings).excluded) ?? null : null;
  if (!p && !ctx.positioning && ctx.dealReasons.length === 0) return "";
  const parts = [];
  const title = p?.profile_name ? `## \u{1F4C7} \u8D26\u53F7\u80CC\u666F\uFF1A${p.profile_name}` : "## \u{1F4C7} \u8D26\u53F7\u80CC\u666F";
  if (p) {
    const want = new Set(manifestOf(module2)?.profile ?? []);
    parts.push(title, "");
    const persona = personaFactsBlock(p.persona_facts);
    if (persona) parts.push(persona, "");
    if (want.has("account")) {
      parts.push(join([
        line("\u5E73\u53F0", p.account_platform),
        line("\u8D5B\u9053", p.account_track),
        line("\u8D26\u53F7\u9636\u6BB5", [text2(p.account_stage), text2(p.fans_level)].filter(Boolean).join(" \xB7 ")),
        line("\u5185\u5BB9\u5F62\u5F0F", p.content_format)
      ]), "");
      const facts = line("\u771F\u5B9E\u60C5\u51B5\uFF08\u5E74\u9650\u3001\u7ECF\u5386\u3001\u7C4D\u8D2F\u4EE5\u6B64\u4E3A\u51C6\uFF0C\u4E0D\u8981\u6539\u5199\u6216\u5938\u5927\uFF09", p.interview_highlights?.trim().replace(/\s*\n+\s*/g, "\uFF1B"), 600);
      if (facts) parts.push(facts, "");
      if (module2 === "freeChat") parts.push(mixContextLine(resolveMix(p)), "");
    }
    if (want.has("audience")) parts.push(describeAudience(p, "full"), "");
    if (want.has("tone")) {
      parts.push(join([
        line("\u8BF4\u8BDD\u8BED\u6C14", p.content_tone),
        line("\u5185\u5BB9\u98CE\u683C", p.content_style)
      ]), "");
    }
    if (want.has("selling")) {
      parts.push(join([
        line("\u6838\u5FC3\u5356\u70B9", p.unique_selling_point, 500),
        line("\u5185\u5BB9\u4EF7\u503C", p.content_value, 300),
        line("\u5DF2\u9A8C\u8BC1\u7684\u5F00\u573A\u94A9\u5B50", p.conversion_hooks, 500)
      ]), "");
    }
    if (want.has("shooting")) parts.push(describeShootingSetup(p), "");
    if (want.has("monetize")) {
      parts.push(join([
        line("\u53D8\u73B0\u65B9\u5F0F", p.monetization_model),
        line("\u4EF7\u683C\u533A\u95F4", p.price_range),
        line("\u6210\u4EA4\u8DEF\u5F84", p.conversion_path, 400),
        line("\u6210\u4EA4\u969C\u788D", p.conversion_barriers, 400)
      ]), "");
    }
    if (want.has("viral")) {
      parts.push(join([
        line("\u5DF2\u6709\u7684\u5185\u5BB9\u65B9\u5411", p.content_themes, 600),
        line("\u8FD9\u4E2A\u53F7\u7684\u7206\u6B3E\u57FA\u56E0", p.viral_content_pattern, 400),
        line("\u5DEE\u5F02\u5316\u4F18\u52BF", p.competitive_advantage, 400)
      ]), "");
    }
    if (want.has("restrictions")) parts.push(describeRestrictions(p), "");
    if (module2 === "review") {
      parts.push("**\u5BA1\u7A3F\u5148\u6309\u5F53\u524D\u7A3F\u4EF6\u4E0E\u672C\u8F6E\u8981\u6C42\u5224\u65AD**\uFF1A\u4FDD\u7559\u4F5C\u8005\u58F0\u97F3\uFF0C\u6838\u5BF9\u4E8B\u5B9E\u4E0E\u7981\u5FCC\uFF1B\u8D26\u53F7\u957F\u671F\u4EBA\u7FA4\u3001\u4E1A\u52A1\u4E0E\u98CE\u683C\u4EC5\u4F5C\u80CC\u666F\uFF0C\u4E0D\u80FD\u628A\u672C\u6761\u89C2\u5BDF\u8BB0\u5F55\u5F3A\u6539\u6210\u9762\u5411\u8001\u677F\u7684\u83B7\u5BA2\u5185\u5BB9\u3002", "");
    }
  }
  const brief = briefBlockFor(ctx.brief, module2);
  if (brief) {
    parts.push("", brief);
    if (p) {
      parts.push("", briefOlderThanProfile(ctx) ? "\u26A0\uFE0F \u8D26\u53F7\u6863\u6848\u5728\u8FD9\u4EFD\u7B80\u62A5\u751F\u6210\u4E4B\u540E\u6539\u8FC7\uFF1A\u7B80\u62A5\u91CC\u7684\u4EBA\u8BBE\u4E8B\u5B9E\uFF08\u5E74\u9650\u3001\u7ECF\u5386\u3001\u7C4D\u8D2F\u3001\u4EF7\u683C\u3001\u54C1\u7C7B\uFF09\u53EF\u80FD\u5DF2\u7ECF\u8FC7\u65F6\uFF0C**\u548C\u4E0A\u9762\u8D26\u53F7\u80CC\u666F\u5BF9\u4E0D\u4E0A\u7684\u4E00\u5F8B\u4EE5\u8D26\u53F7\u80CC\u666F\u4E3A\u51C6**\u3002" : "\u7B80\u62A5\u91CC\u7684\u4E8B\u5B9E\uFF08\u5E74\u9650\u3001\u7ECF\u5386\u3001\u7C4D\u8D2F\u3001\u4EF7\u683C\u3001\u54C1\u7C7B\uFF09\u5982\u679C\u548C\u4E0A\u9762\u8D26\u53F7\u80CC\u666F\u5BF9\u4E0D\u4E0A\uFF0C\u4EE5\u8D26\u53F7\u80CC\u666F\u4E3A\u51C6\u3002");
    }
  } else if (ctx.positioning) {
    const body = module2 === "topic" ? ctx.positioning.summary : ctx.positioning.full;
    if (body) {
      parts.push(
        "",
        `## \u{1F3AF} \u5DF2\u786E\u5B9A\u7684\u8D26\u53F7\u5B9A\u4F4D`,
        "",
        text2(body, 2e3),
        "",
        "\u26A0\uFE0F \u4EE5\u4E0A\u662F\u8FD9\u4E2A\u53F7\u5DF2\u7ECF\u5B9A\u597D\u7684\u65B9\u5411\uFF0C\u4EA7\u51FA\u5FC5\u987B\u4E0E\u5B83\u4E00\u81F4\uFF0C\u4E0D\u8981\u53E6\u8D77\u7089\u7076\u3002",
        "\uFF08\u8FD9\u4E00\u6BB5\u662F\u4ECE\u5B9A\u4F4D\u539F\u6587\u622A\u65AD\u6765\u7684\u3002\u751F\u6210\u4E00\u4EFD\u300C\u521B\u4F5C\u7B80\u62A5\u300D\u53EF\u4EE5\u8BA9\u5404\u677F\u5757\u62FF\u5230\u5B8C\u6574\u65B9\u5411\u3002\uFF09"
      );
    }
  }
  if (PERFORMANCE_BOARDS.has(module2)) {
    const perf = performancePromptBlock(ctx.performance);
    if (perf) parts.push("", perf);
  }
  if (PRESET_BOARDS.has(module2)) {
    const style = presetPromptBlock(ctx.preset);
    if (style) parts.push("", style);
  }
  if (PREFERENCE_BOARDS.has(module2)) {
    const pref = preferencePromptBlock(ctx.preferences);
    if (pref) parts.push("", pref);
  }
  if (OUTPUT_RULE_BOARDS.has(module2)) parts.push("", outputRulesBlock());
  if (ctx.dealReasons.length > 0 && manifestOf(module2)?.dealReasons) {
    parts.push(
      "",
      "## \u{1F4B0} \u8FD9\u4E2A\u8D26\u53F7\u7684\u6210\u4EA4\u7406\u7531",
      "",
      ctx.dealReasons.map((r) => `- ${r}`).join("\n"),
      "",
      "\u5185\u5BB9\u8981\u80FD\u4F53\u73B0\u8FD9\u4E9B\u7406\u7531\uFF0C\u4F46\u4E0D\u662F\u786C\u585E\u2014\u2014\u653E\u5728\u5177\u4F53\u573A\u666F\u91CC\u8BB2\u51FA\u6765\u3002"
    );
  }
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// .tmp/content-audit-production_20261008/lib/growth-tactics.ts
var GROWTH_TACTICS = [
  {
    no: 1,
    name: "\u53CD\u5411\u64CD\u4F5C",
    source: "\u7B2C41\u8282",
    mechanism: "\u628A\u884C\u4E1A\u5E38\u89C4\u52A8\u4F5C\u3001\u89D2\u8272\u6216\u7ED3\u8BBA\u5012\u8FC7\u6765",
    formula: "\u5E38\u89C4A \u2192 \u53CD\u5411B \u2192 \u771F\u5B9E\u53CD\u5E94/\u7ED3\u679C",
    fit: "\u670D\u52A1\u3001\u6559\u5B66\u3001\u7F8E\u98DF\u3001\u6444\u5F71",
    howto: "\u5148\u5217\u51FA\u540C\u884C\u9ED8\u8BA4\u505A\u6CD5\uFF1B\u53EA\u53CD\u8F6C\u4E00\u4E2A\u5173\u952E\u53D8\u91CF\uFF1B\u7528\u73B0\u573A\u4E92\u52A8\u8BC1\u660E\u53CD\u8F6C\u7684\u8DA3\u5473\u6216\u4EF7\u503C\u3002",
    cases: "\u6444\u5F71\u5E08\u62CD\u666E\u901A\u4EBA\uFF1B\u987E\u5BA2\u7ED9\u6280\u5E08\u6309\u6469\uFF1B\u8001\u5E08\u6545\u610F\u793A\u8303\u9519\u8BEF\u5F15\u5BFC\u7EA0\u6B63\u3002",
    limit: "\u53CD\u8F6C\u4E0D\u80FD\u4EE5\u7F9E\u8FB1\u3001\u5371\u9669\u6216\u9519\u8BEF\u77E5\u8BC6\u4F24\u5BB3\u7528\u6237\uFF1B\u201C\u6559\u9519\u201D\u5FC5\u987B\u8BA9\u89C2\u4F17\u6700\u7EC8\u80FD\u8BC6\u522B\u6B63\u786E\u7B54\u6848\u3002"
  },
  {
    no: 2,
    name: "\u626E\u732A\u5403\u864E",
    source: "\u7B2C42\u8282",
    mechanism: "\u9690\u85CF\u5B9E\u529B\uFF0C\u5148\u88AB\u8F7B\u89C6\u518D\u7528\u80FD\u529B\u5B8C\u6210\u53CD\u8F6C",
    formula: "\u4F4E\u9884\u671F \u2192 \u8D28\u7591/\u51B2\u7A81 \u2192 \u5B9E\u529B\u5C55\u793A \u2192 \u723D\u611F\u56DE\u6536",
    fit: "\u6280\u80FD\u3001\u4F53\u80B2\u3001\u804C\u573A\u3001\u827A\u672F",
    howto: "\u5148\u8BA9\u89C2\u4F17\u7406\u89E3\u4F4E\u9884\u671F\u6765\u6E90\uFF1B\u5BF9\u624B\u8D8A\u771F\u5B9E\u3001\u53CD\u8F6C\u8D8A\u6709\u529B\uFF1B\u4E13\u4E1A\u8868\u73B0\u5FC5\u987B\u53EF\u9A8C\u8BC1\u3002",
    cases: "\u666E\u901A\u5B66\u751F\u4E3E\u5927\u91CD\u91CF\uFF1B\u7406\u8BBA\u9009\u624B\u51FB\u8D25\u9AD8\u624B\uFF1B\u4EE3\u8BFE\u8001\u5E08\u5C55\u793A\u94A2\u7434\u5B9E\u529B\u3002",
    limit: "\u4E0D\u8981\u4F2A\u9020\u6C42\u804C\u3001\u4E13\u4E1A\u8D44\u8D28\u6216\u6B3A\u9A97\u65E0\u5173\u8DEF\u4EBA\uFF1B\u6F14\u5458\u53C2\u4E0E\u5E94\u786E\u4FDD\u5B89\u5168\u4E0E\u6388\u6743\u3002"
  },
  {
    no: 3,
    name: "\u4EE5\u7269\u6362\u7269",
    source: "\u7B2C43\u8282",
    mechanism: "\u7528\u5B9E\u4F53\u7269\u54C1\u5EFA\u7ACB\u964C\u751F\u4EBA\u4EA4\u6D41\u5165\u53E3\uFF0C\u4EA4\u6362\u6545\u4E8B\u4E0E\u5584\u610F",
    formula: "\u63D0\u51FA\u4EA4\u6362 \u2192 \u534F\u5546 \u2192 \u4F53\u9A8C \u2192 \u6316\u6398\u4EBA\u7269 \u2192 \u60C5\u611F\u7ED3\u679C",
    fit: "\u5B9E\u4F53\u5546\u54C1\u3001\u63A2\u5E97\u3001\u624B\u5DE5\u3001\u5730\u65B9\u6587\u5316",
    howto: "\u4EA4\u6362\u7269\u8981\u4E0E\u8D26\u53F7/\u54C1\u724C\u6709\u5173\uFF1B\u91CD\u70B9\u62CD\u6C9F\u901A\u4E0E\u4EBA\u7269\uFF0C\u800C\u975E\u53EA\u62CD\u7269\u4EF7\uFF1B\u5EFA\u7ACB\u53EF\u6301\u7EED\u7CFB\u5217\u89C4\u5219\u3002",
    cases: "\u9152\u6362\u996D\u548C\u8001\u677F\u6545\u4E8B\uFF1B\u8336\u53F6\u6362\u7231\u5FC3\u9910\uFF1B\u6811\u53F6\u5DE5\u827A\u6362\u996E\u54C1\u3002",
    limit: "\u4E0D\u80FD\u5F3A\u8FEB\u5546\u5BB6\u3001\u9690\u85CF\u5546\u4E1A\u5408\u4F5C\u6216\u5229\u7528\u5F31\u52BF\u4EBA\u7269\u717D\u60C5\uFF1B\u6CE8\u610F\u4EA4\u6613\u4E0E\u5F69\u7968\u7B49\u9886\u57DF\u5408\u89C4\u3002"
  },
  {
    no: 4,
    name: "\u501F\u7269\u55BB\u4EBA",
    source: "\u7B2C44\u8282",
    mechanism: "\u501F\u7269\u4F53\u72B6\u6001\u3001\u52A8\u4F5C\u6216\u5173\u7CFB\u9690\u55BB\u4EBA\u7684\u5904\u5883\u4E0E\u60C5\u611F",
    formula: "\u7269\u7684\u4E8B\u4EF6 \u2192 \u53CC\u5173\u5BF9\u5E94 \u2192 \u60C5\u7EEA\u63A8\u8FDB \u2192 \u4EBA\u751F\u843D\u70B9",
    fit: "\u60C5\u611F\u3001\u54F2\u7406\u3001\u6570\u7801\u3001\u751F\u6D3B",
    howto: "\u5148\u627E\u7269\u4E0E\u4EBA\u771F\u6B63\u5171\u4EAB\u7684\u5173\u7CFB\u8BCD\uFF1B\u8BA9\u8868\u5C42\u6545\u4E8B\u72EC\u7ACB\u6210\u7ACB\uFF1B\u7ED3\u5C3E\u8F7B\u70B9\u4E0D\u89E3\u91CA\u8FC7\u6EE1\u3002",
    cases: "\u4E22\u8033\u673A\u9690\u55BB\u5931\u53BB\uFF1B\u4E4C\u9F9F\u4E0A\u5CB8\u9690\u55BB\u9009\u62E9\uFF1B\u505C\u8F66\u4F4D\u9690\u55BB\u9519\u8FC7\u3002",
    limit: "\u907F\u514D\u4F4E\u4FD7\u6697\u793A\u3001\u6B67\u89C6\u548C\u7275\u5F3A\u6BD4\u55BB\uFF1B\u4E0D\u8981\u7528\u542B\u6DF7\u9690\u55BB\u4F20\u64AD\u9519\u8BEF\u5065\u5EB7\u4FE1\u606F\u3002"
  },
  {
    no: 5,
    name: "\u8DE8\u754C\u786C\u7EC4\u5408",
    source: "\u7B2C45\u8282",
    mechanism: "\u540C\u4E00\u65F6\u95F4\u5E76\u7F6E\u4E24\u4E2A\u65E0\u76F4\u63A5\u903B\u8F91\u5173\u7CFB\u7684\u8D5B\u9053",
    formula: "\u4E3B\u4FE1\u606FA + \u89C6\u89C9/\u542C\u89C9B \u2192 \u53CC\u500D\u4FE1\u606F\u5BC6\u5EA6",
    fit: "\u7A84\u8D5B\u9053\u3001\u77E5\u8BC6\u3001\u6545\u4E8B\u3001\u624D\u827A",
    howto: "A\u8D1F\u8D23\u4EF7\u503C\uFF0CB\u8D1F\u8D23\u89C6\u89C9\u6216\u8282\u594F\uFF1B\u5148\u4FDD\u8BC1\u5176\u4E2D\u4E00\u9879\u8DB3\u591F\u5F3A\uFF1B\u6D4B\u8BD5\u7EC4\u5408\u662F\u5426\u5206\u6563\u7406\u89E3\u3002",
    cases: "\u505A\u996D+\u8BB2\u6545\u4E8B\uFF1B\u5F8B\u5E08+\u8DF3\u821E\uFF1B\u6309\u6469\u753B\u9762+\u6E2F\u5267\u914D\u97F3\u3002",
    limit: "\u4E0D\u8981\u4E3A\u4E86\u4FE1\u606F\u91CF\u5BFC\u81F4\u8BA4\u77E5\u8FC7\u8F7D\uFF1B\u97F3\u4E50\u3001\u5F71\u89C6\u548C\u821E\u8E48\u7D20\u6750\u9700\u6709\u6743\u4F7F\u7528\u3002"
  },
  {
    no: 6,
    name: "\u8F6F\u7EC4\u5408\uFF1A\u7528A\u65B9\u5F0F\u505AB\u4E8B",
    source: "\u7B2C46\u8282",
    mechanism: "\u628A\u53E6\u4E00\u884C\u4E1A\u7684\u884C\u4E3A\u6A21\u5F0F\u5D4C\u5165\u672C\u884C\u4E1A\u52A8\u4F5C",
    formula: "\u65B9\u5F0FA \xD7 \u4EFB\u52A1B \u2192 \u65B0\u884C\u4E3A",
    fit: "\u670D\u52A1\u3001\u9910\u996E\u3001\u5BA0\u7269\u3001\u95E8\u5E97",
    howto: "\u62C6\u51FAA\u7684\u5178\u578B\u8BED\u8A00\u3001\u8282\u594F\u3001\u52A8\u4F5C\uFF1B\u5BFB\u627EB\u4E2D\u80FD\u4E00\u4E00\u5BF9\u5E94\u7684\u6D41\u7A0B\uFF1B\u5F62\u6210\u7CFB\u5217\u53D8\u4F53\u3002",
    cases: "\u4F1A\u6240\u7ECF\u7406\u5F0F\u8BAD\u732B\uFF1B\u673A\u68B0\u821E\u4E0A\u83DC\uFF1B\u5929\u6C14\u9884\u62A5\u64AD\u7F8E\u5BB9\u9662\u4E1A\u7EE9\u3002",
    limit: "\u907F\u514D\u5BF9\u804C\u4E1A\u7FA4\u4F53\u523B\u677F\u5316\u3001\u7F9E\u8FB1\u5458\u5DE5\u6216\u59A8\u788D\u6B63\u5E38\u670D\u52A1\u3002"
  },
  {
    no: 7,
    name: "\u4E00\u53E5\u8BDD\u8BBE\u5B9A\u6545\u4E8B\u611F",
    source: "\u7B2C47\u8282",
    mechanism: "\u7528\u4E00\u53E5\u80CC\u666F\u6587\u6848\u8D4B\u4E88\u666E\u901A\u753B\u9762\u52A8\u673A\u4E0E\u5173\u7CFB",
    formula: "\u666E\u901A\u52A8\u4F5C + \u76EE\u6807/\u56F0\u5883/\u5173\u7CFB\u8BBE\u5B9A \u2192 \u6545\u4E8B\u671F\u5F85",
    fit: "\u7A7F\u642D\u3001\u505A\u996D\u3001\u8BBE\u8BA1\u3001\u5531\u6B4C\u3001Vlog",
    howto: "\u4E00\u53E5\u8BDD\u5FC5\u987B\u6539\u53D8\u89C2\u4F17\u5BF9\u753B\u9762\u7684\u7406\u89E3\uFF1B\u4F18\u5148\u5199\u4EBA\u7269\u3001\u76EE\u6807\u3001\u963B\u788D\uFF1B\u540E\u7EED\u753B\u9762\u9700\u63D0\u4F9B\u8BC1\u636E\u3002",
    cases: "\u505A\u996D+\u5B58\u94B1\u4E70\u623F\uFF1B\u5730\u94C1\u5316\u5986+\u4E34\u65F6\u76F8\u4EB2\uFF1B\u753B\u56FE+\u7ED9\u5973\u513F\u66F4\u597D\u751F\u6D3B\u3002",
    limit: "\u4E0D\u80FD\u7528\u865A\u5047\u8EAB\u4E16\u3001\u4EB2\u60C5\u6216\u82E6\u96BE\u9A97\u53D6\u540C\u60C5\uFF1B\u4E0D\u5F97\u76F4\u63A5\u4F7F\u7528\u540C\u884C\u7D20\u6750\u3002"
  },
  {
    no: 8,
    name: "\u52A0\u5165\u4EBA\u7269\u5173\u7CFB",
    source: "\u7B2C48\u8282",
    mechanism: "\u8BA9\u5173\u7CFB\u4E2D\u7684\u671F\u5F85\u3001\u53CD\u5E94\u4E0E\u51B2\u7A81\u6210\u4E3A\u770B\u70B9",
    formula: "\u4E3B\u4EFB\u52A1 + \u5173\u7CFB\u89D2\u8272\u51FA\u955C + \u4E92\u52A8\u7ED3\u679C",
    fit: "\u5BB6\u5EAD\u3001\u6559\u5B66\u3001\u5065\u8EAB\u3001\u63A2\u623F\u3001\u7F8E\u98DF",
    howto: "\u9009\u62E9\u81EA\u5E26\u89D2\u8272\u671F\u5F85\u7684\u5173\u7CFB\uFF1B\u4E3A\u53CC\u65B9\u8BBE\u8BA1\u529F\u80FD\uFF1B\u4FDD\u7559\u771F\u5B9E\u53CD\u5E94\u4E0E\u957F\u671F\u6210\u957F\u7EBF\u3002",
    cases: "\u5E26\u8001\u5988\u5065\u8EAB\uFF1B\u6559\u7537\u53CB\u505A\u996D\uFF1B\u5973\u513F\u5E26\u7238\u7238\u76F8\u4EB2\uFF1B\u5E08\u5F92\u780D\u4EF7\u3002",
    limit: "\u786E\u4FDD\u5BF9\u65B9\u81EA\u613F\u3001\u53EF\u6301\u7EED\uFF1B\u513F\u7AE5\u4E0E\u5BB6\u4EBA\u9690\u79C1\u4F18\u5148\uFF0C\u4E0D\u628A\u5173\u7CFB\u5F53\u6D88\u8017\u54C1\u3002"
  },
  {
    no: 9,
    name: "\u4E00\u4EBA\u5206\u9970\u591A\u89D2",
    source: "\u7B2C49\u8282",
    mechanism: "\u4E00\u4EBA\u627F\u62C5\u591A\u89D2\u8272\uFF0C\u901A\u8FC7\u5BF9\u8BDD\u6F14\u7ECE\u77E5\u8BC6\u6216\u51B2\u7A81",
    formula: "\u89D2\u8272A\u89C2\u70B9 \u2194 \u89D2\u8272B\u56DE\u5E94 \u2192 \u77E5\u8BC6/\u53CD\u8F6C",
    fit: "\u77E5\u8BC6\u3001\u54C1\u724C\u6D4B\u8BC4\u3001\u6BB5\u5B50\u3001\u5185\u5E55",
    howto: "\u7528\u670D\u88C5\u3001\u673A\u4F4D\u3001\u58F0\u97F3\u533A\u5206\u89D2\u8272\uFF1B\u6BCF\u4E2A\u89D2\u8272\u7ACB\u573A\u660E\u786E\uFF1B\u5BF9\u767D\u77ED\u800C\u63A8\u8FDB\u3002",
    cases: "\u7236\u5B50\u8BF4\u5531\uFF1B\u7236\u5B50\u8C08\u8336\u53F6\u5B9A\u4EF7\uFF1B\u54C1\u724C\u62DF\u4EBA\u5316\u73ED\u7EA7\u3002",
    limit: "\u4E0D\u8981\u5192\u5145\u771F\u5B9E\u54C1\u724C\u5B98\u65B9\u6216\u865A\u6784\u4E8B\u5B9E\u6027\u5185\u5E55\uFF1B\u907F\u514D\u4EBA\u7269\u523B\u677F\u5316\u3002"
  },
  {
    no: 10,
    name: "\u60C5\u5883\u8FD8\u539F",
    source: "\u7B2C50\u8282",
    mechanism: "\u628A\u77E5\u8BC6\u653E\u8FDB\u5176\u81EA\u7136\u53D1\u751F\u7684\u73B0\u573A",
    formula: "\u771F\u5B9E\u4EFB\u52A1 \u2192 \u5BF9\u8BDD/\u7EA0\u9519 \u2192 \u65C1\u89C2\u5B66\u4E60 \u2192 \u7ED3\u679C",
    fit: "\u4E13\u4E1A\u670D\u52A1\u3001\u6559\u5B66\u3001\u4EB2\u5B50\u3001\u5E26\u8D27",
    howto: "\u5148\u627E\u7528\u6237\u771F\u5B9E\u63A5\u89E6\u77E5\u8BC6\u7684\u573A\u666F\uFF1B\u8BA9\u4E13\u4E1A\u8005\u5BF9\u73B0\u573A\u5BF9\u8C61\u8BF4\uFF1B\u4FDD\u7559\u64CD\u4F5C\u4E0E\u53CD\u9988\u3002",
    cases: "\u9009\u94FA\u73B0\u573A\uFF1B\u88C5\u4FEE\u9A8C\u6536\uFF1B\u533B\u751F\u95EE\u8BCA\uFF1B\u6559\u5B69\u5B50\u62FC\u97F3\uFF1B\u6444\u5F71\u8D70\u4F4D\u6559\u5B66\u3002",
    limit: "\u4E0D\u662F\u753B\u9762\u968F\u624B\u5C31\u7B49\u4E8E\u771F\u5B9E\uFF1B\u533B\u7597/\u80B2\u513F\u7B49\u5185\u5BB9\u9700\u4E13\u4E1A\u5BA1\u6838\u548C\u9690\u79C1\u540C\u610F\u3002"
  },
  {
    no: 11,
    name: "Rap+\u884C\u4E1A",
    source: "\u7B2C52\u8282",
    mechanism: "\u628A\u884C\u4E1A\u6587\u6848\u6539\u6210\u62BC\u97F5\u548C\u8282\u594F\u8868\u8FBE",
    formula: "\u77E5\u8BC6\u8981\u70B9 \u2192 \u8282\u594F\u5206\u53E5 \u2192 \u62BC\u97F5\u8BB0\u5FC6 \u2192 \u7ED3\u8BBA",
    fit: "\u67AF\u71E5\u77E5\u8BC6\u3001\u5185\u5E55\u3001\u6C7D\u8F66\u3001\u6559\u80B2",
    howto: "\u5148\u4FDD\u8BC1\u4E8B\u5B9E\u987A\u5E8F\uFF0C\u518D\u62BC\u97F5\uFF1B\u5173\u952E\u8BCD\u843D\u5728\u91CD\u62CD\uFF1B\u5B57\u5E55\u5E2E\u52A9\u7406\u89E3\u3002",
    cases: "Rap\u8BB2\u6C7D\u4FEE\u6392\u6C34\u3001\u6587\u732E\u7EFC\u8FF0\u3001\u8D85\u8DD1\u6210\u672C\u3001\u9EC4\u725B\u5185\u5E55\u3002",
    limit: "\u5DE5\u5177\u751F\u6210\u62BC\u97F5\u53EA\u80FD\u8F85\u52A9\uFF0C\u9700\u4EBA\u5DE5\u6838\u5B9E\u4E8B\u5B9E\u4E0E\u8BED\u4E49\uFF1B\u97F3\u4E50\u4F34\u594F\u9700\u6388\u6743\u3002"
  },
  {
    no: 12,
    name: "\u501F\u52BF\u70B9\u8BC4",
    source: "\u7B2C53\u8282",
    mechanism: "\u501F\u70ED\u70B9\u5BF9\u8C61\u7684\u5173\u6CE8\uFF0C\u7528\u4E13\u4E1A\u89C6\u89D2\u63D0\u4F9B\u589E\u91CF\u89E3\u91CA",
    formula: "\u70ED\u70B9\u4E8B\u5B9E \u2192 \u4E13\u4E1A\u62C6\u89E3 \u2192 \u5224\u65AD/\u5EFA\u8BAE \u2192 \u56DE\u5230\u7528\u6237",
    fit: "\u670D\u88C5\u3001\u533B\u7F8E\u3001\u5496\u5561\u3001\u51CF\u8102\u7B49",
    howto: "\u9009\u4E0E\u884C\u4E1A\u9AD8\u5EA6\u76F8\u5173\u7684\u70ED\u70B9\uFF1B\u5148\u6838\u5B9E\u4E8B\u5B9E\uFF1B\u63D0\u4F9B\u53EA\u6709\u4E13\u4E1A\u8005\u80FD\u770B\u51FA\u7684\u7EC6\u8282\u3002",
    cases: "\u62C6\u5267\u4E2D\u7A7F\u642D\uFF1B\u5206\u6790\u660E\u661F\u4E94\u5B98\uFF1B\u70B9\u8BC4\u660E\u661F\u51CF\u80A5\u6CD5\uFF1B\u7EA0\u9519\u5F71\u89C6\u5496\u5561\u64CD\u4F5C\u3002",
    limit: "\u907F\u514D\u8E6D\u707E\u96BE\u3001\u4FB5\u72AF\u540D\u8A89\u548C\u4F20\u64AD\u672A\u7ECF\u8BC1\u5B9E\u4FE1\u606F\uFF1B\u70ED\u70B9\u7D20\u6750\u4F7F\u7528\u987B\u5408\u89C4\u3002"
  },
  {
    no: 13,
    name: "\u8DDF\u7740\u535A\u4E3B\u505A",
    source: "\u7B2C54\u8282",
    mechanism: "\u4EB2\u81EA\u590D\u73B0\u5DF2\u7ECF\u88AB\u9A8C\u8BC1\u7684\u52A8\u4F5C\u6216\u6D41\u7A0B",
    formula: "\u9009\u62E9\u6837\u672C \u2192 \u8DDF\u505A \u2192 \u5C55\u793A\u5DEE\u5F02/\u7ED3\u679C \u2192 \u8BC4\u4EF7",
    fit: "\u6559\u7A0B\u3001\u7F8E\u98DF\u3001\u8FD0\u52A8\u3001\u7A7F\u642D\u3001\u6D4B\u8BC4",
    howto: "\u8BF4\u660E\u53C2\u8003\u6765\u6E90\uFF1B\u590D\u73B0\u5173\u952E\u6761\u4EF6\uFF1B\u8F93\u51FA\u81EA\u5DF1\u7684\u8FC7\u7A0B\u3001\u7ED3\u679C\u548C\u7ED3\u8BBA\u3002",
    cases: "\u8DDF\u7EC3\u7BEE\u7403\u52A8\u4F5C\uFF1B\u590D\u523B\u83DC\u8C31\uFF1B\u6D4B\u8BD5\u535A\u4E3B\u62A4\u80A4\u6D41\u7A0B\uFF1B\u590D\u523B\u5F71\u89C6\u7A7F\u642D\u3002",
    limit: "\u53EA\u80FD\u501F\u9274\u65B9\u6CD5\uFF0C\u4E0D\u80FD\u642C\u8FD0\u6210\u7247\u6216\u9010\u5B57\u590D\u5236\uFF1B\u6D89\u53CA\u5371\u9669\u52A8\u4F5C\u9700\u4E13\u4E1A\u4FDD\u62A4\u3002"
  },
  {
    no: 14,
    name: "\u6A21\u4EFF\u7535\u5F71\u7247\u6BB5",
    source: "\u7B2C55\u8282",
    mechanism: "\u7528\u7ECF\u5178\u620F\u5267\u7ED3\u6784\u6F14\u7ECE\u884C\u4E1A\u65E5\u5E38",
    formula: "\u8BC6\u522B\u540D\u573A\u9762 \u2192 \u66FF\u6362\u89D2\u8272\u76EE\u6807 \u2192 \u884C\u4E1A\u53F0\u8BCD\u6539\u5199 \u2192 \u56DE\u6536\u6897",
    fit: "\u54C1\u724C\u3001\u95E8\u5E97\u3001\u5267\u60C5\u3001\u804C\u573A",
    howto: "\u4FDD\u7559\u89C2\u4F17\u80FD\u8BC6\u522B\u7684\u8282\u594F\u548C\u5173\u7CFB\uFF0C\u800C\u975E\u5927\u6BB5\u590D\u5236\u53F0\u8BCD\uFF1B\u8BA9\u884C\u4E1A\u4FE1\u606F\u63A8\u52A8\u5267\u60C5\u3002",
    cases: "\u4E8C\u624B\u8F66\u7248\u300A\u559C\u5267\u4E4B\u738B\u300B\uFF1B\u90AE\u653F\u7248\u300A\u65E0\u95F4\u9053\u300B\uFF1B\u8FD0\u8425\u7248\u519B\u4EE4\u72B6\u3002",
    limit: "\u5F71\u89C6\u7248\u6743\u4E0E\u97F3\u4E50\u98CE\u9669\u9AD8\uFF1B\u4F18\u5148\u505A\u81F4\u656C\u5F0F\u539F\u521B\u6539\u5199\uFF0C\u4E0D\u76F4\u63A5\u4F7F\u7528\u539F\u7247\u3002"
  },
  {
    no: 15,
    name: "\u6B63\u786E\u505A\u6CD5VS\u9519\u8BEF\u505A\u6CD5",
    source: "\u7B2C56\u8282",
    mechanism: "\u7528\u9C9C\u660E\u5BF9\u6BD4\u964D\u4F4E\u7406\u89E3\u6210\u672C",
    formula: "\u9519\u8BEF\u793A\u8303 \u2192 \u540E\u679C \u2192 \u6B63\u786E\u793A\u8303 \u2192 \u539F\u7406/\u9002\u7528\u6761\u4EF6",
    fit: "\u5065\u8EAB\u3001\u80B2\u513F\u3001\u82F1\u8BED\u3001\u6C9F\u901A",
    howto: "\u540C\u4E00\u573A\u666F\u3001\u540C\u4E00\u76EE\u6807\u3001\u53EA\u6539\u53D8\u5173\u952E\u52A8\u4F5C\uFF1B\u7ED3\u679C\u53EF\u89C6\u5316\uFF1B\u8BF4\u660E\u4E3A\u4F55\u6B63\u786E\u3002",
    cases: "\u5065\u8EAB\u52A8\u4F5C\u5BF9\u6BD4\uFF1B\u80B2\u513F\u547D\u4EE4\u5F0Fvs\u6E38\u620F\u5316\uFF1B\u6C9F\u901A\u903C\u95EEvs\u5171\u60C5\u3002",
    limit: "\u4E0D\u8981\u4E3A\u5236\u9020\u53CD\u5DEE\u505A\u5371\u9669\u9519\u8BEF\u793A\u8303\uFF1B\u4E13\u4E1A\u7ED3\u8BBA\u987B\u51C6\u786E\uFF0C\u4E0D\u628A\u504F\u597D\u8BF4\u6210\u552F\u4E00\u6B63\u786E\u3002"
  },
  {
    no: 16,
    name: "\u6574\u86CA",
    source: "\u7B2C57\u8282",
    mechanism: "\u8BBE\u7F6E\u65E0\u4F24\u5BB3\u8BEF\u5BFC\uFF0C\u8BA9\u771F\u5B9E\u53CD\u5E94\u4E0E\u53CD\u8F6C\u4EA7\u751F\u559C\u5267",
    formula: "\u94FA\u57AB \u2192 \u8BEF\u5224 \u2192 \u53CD\u5E94\u5347\u7EA7 \u2192 \u63ED\u6653",
    fit: "\u5BB6\u5EAD\u3001\u529E\u516C\u5BA4\u3001\u4EA7\u54C1\u5267\u60C5",
    howto: "\u6574\u86CA\u5BF9\u8C61\u3001\u9053\u5177\u4E0E\u73AF\u5883\u53EF\u63A7\uFF1B\u53CD\u5E94\u662F\u6838\u5FC3\uFF1B\u53CD\u8F6C\u540E\u4FEE\u590D\u5173\u7CFB\u3002",
    cases: "\u5047\u88C5\u4FDD\u6D01\uFF1B\u5047\u89C6\u9891\u901A\u8BDD\u5957\u8BDD\uFF1B\u4EA7\u54C1\u5728\u51B2\u7A81\u4E2D\u81EA\u7136\u690D\u5165\u3002",
    limit: "\u7981\u6B62\u4F24\u5BB3\u3001\u6050\u5413\u3001\u7F9E\u8FB1\u3001\u7834\u574F\u8D22\u7269\u3001\u5371\u9669\u98DF\u7269\u548C\u672A\u7ECF\u540C\u610F\u516C\u5F00\u9690\u79C1\u3002"
  },
  {
    no: 17,
    name: "\u4E92\u8054\u7F51\u5634\u66FF/\u66FF\u7F51\u53CB\u505A",
    source: "\u7B2C58\u8282",
    mechanism: "\u66FF\u7C89\u4E1D\u5B8C\u6210\u60F3\u505A\u4F46\u6CA1\u6761\u4EF6\u505A\u7684\u4EFB\u52A1",
    formula: "\u5F81\u96C6\u95EE\u9898 \u2192 \u9009\u62E9\u4EFB\u52A1 \u2192 \u4EB2\u6D4B\u8FC7\u7A0B \u2192 \u7ED3\u679C\u4E0E\u5EFA\u8BAE",
    fit: "\u5B9E\u9A8C\u3001\u6D4B\u8BC4\u3001\u7F8E\u98DF\u3001\u7A7F\u642D\u3001\u51CF\u8102",
    howto: "\u8BA9\u4EFB\u52A1\u6765\u81EA\u771F\u5B9E\u8BC4\u8BBA\uFF1B\u8BF4\u660E\u6D4B\u8BD5\u6761\u4EF6\uFF1B\u5931\u8D25\u4E5F\u4FDD\u7559\uFF1B\u5F62\u6210\u6301\u7EED\u680F\u76EE\u3002",
    cases: "\u81EA\u5236\u53EF\u4E50\uFF1B\u68C0\u6D4B\u67B8\u675E\uFF1B\u9A8C\u8BC1\u51CF\u8102\u98DF\u8C31\uFF1B\u66FF\u7C89\u4E1D\u8BD5\u7A7F\u3002",
    limit: "\u5B9E\u9A8C\u3001\u5065\u5EB7\u98DF\u8C31\u4E0E\u68C0\u6D4B\u4E0D\u53EF\u5938\u5927\u4EE3\u8868\u6027\uFF1B\u9AD8\u98CE\u9669\u4EFB\u52A1\u4E0D\u4EE3\u505A\u3002"
  },
  {
    no: 18,
    name: "\u6C42\u52A9\u7F51\u53CB",
    source: "\u7B2C59\u8282",
    mechanism: "\u4E3B\u52A8\u793A\u5F31\u6216\u63D0\u51FA\u95EE\u9898\uFF0C\u628A\u89C2\u4F17\u53D8\u6210\u53C2\u4E0E\u8005",
    formula: "\u5C55\u793A\u56F0\u60D1 \u2192 \u7ED9\u51FA\u5DF2\u77E5\u4FE1\u606F \u2192 \u660E\u786E\u95EE\u9898 \u2192 \u540E\u7EED\u91C7\u7EB3",
    fit: "\u77E5\u8BC6\u63A2\u7D22\u3001\u4EB2\u5B50\u3001\u4E50\u5668\u3001\u4EA7\u54C1\u5171\u521B",
    howto: "\u95EE\u9898\u8981\u5177\u4F53\u4E14\u89C2\u4F17\u771F\u80FD\u56DE\u7B54\uFF1B\u4F18\u8D28\u7B54\u6848\u4E0B\u96C6\u9A8C\u8BC1\uFF1B\u516C\u5F00\u611F\u8C22\u8D21\u732E\u8005\u3002",
    cases: "\u8FA8\u8BA4\u624B\u98CE\u7434\u6309\u952E\uFF1B\u8BA8\u8BBA\u4E09\u89D2\u94C1\u6F14\u594F\uFF1B\u8BF7\u7F51\u53CB\u5171\u540C\u9009\u62E9\u65B9\u6848\u3002",
    limit: "\u4E0D\u80FD\u5047\u88C5\u65E0\u77E5\u4F20\u64AD\u9519\u8BEF\uFF1B\u201C\u4E91\u770B\u5A03\u201D\u7B49\u5185\u5BB9\u4E0D\u53EF\u66FF\u4EE3\u5B9E\u9645\u76D1\u62A4\u3002"
  },
  {
    no: 19,
    name: "\u5BF9\u6BD4\u6539\u9020",
    source: "\u7B2C60\u8282",
    mechanism: "\u5C55\u793A\u4ECE\u95EE\u9898\u72B6\u6001\u5230\u7406\u60F3\u72B6\u6001\u7684\u53EF\u89C6\u5316\u53D8\u5316",
    formula: "\u6539\u9020\u524D \u2192 \u76EE\u6807/\u9884\u7B97 \u2192 \u5173\u952E\u6B65\u9AA4 \u2192 \u6539\u9020\u540E \u2192 \u590D\u76D8",
    fit: "\u88C5\u4FEE\u3001\u7F8E\u5986\u3001\u7406\u53D1\u3001\u6C7D\u4FEE\u3001\u5065\u8EAB",
    howto: "\u524D\u540E\u4F7F\u7528\u540C\u89D2\u5EA6\u540C\u5149\u7EBF\uFF1B\u8BB0\u5F55\u6210\u672C\u3001\u65F6\u95F4\u4E0E\u56F0\u96BE\uFF1B\u7ED3\u679C\u4E0D\u53EA\u9760\u6EE4\u955C\u3002",
    cases: "\u8352\u5C9B\u5230\u5C45\u6240\uFF1B\u53A8\u623F\u7FFB\u65B0\uFF1B\u8DEF\u4EBA\u53D1\u578B\uFF1B\u5168\u987A\u6539\u623F\u8F66\u3002",
    limit: "\u9700\u83B7\u5F97\u88AB\u6539\u9020\u8005\u540C\u610F\uFF1B\u907F\u514D\u7F9E\u8FB1\u201C\u6539\u9020\u524D\u201D\uFF1B\u5982\u5B9E\u62AB\u9732\u5E7F\u544A\u4E0E\u6210\u672C\u3002"
  },
  {
    no: 20,
    name: "\u62DF\u4EBA\u5316",
    source: "\u7B2C61\u8282",
    mechanism: "\u8D4B\u4E88\u7269\u54C1\u6216\u52A8\u7269\u4EBA\u683C\u3001\u5173\u7CFB\u548C\u53F0\u8BCD",
    formula: "\u7269/\u52A8\u7269\u89D2\u8272 \u2192 \u4EBA\u7C7B\u6B32\u671B/\u51B2\u7A81 \u2192 \u5BF9\u8BDD \u2192 \u7ED3\u679C",
    fit: "\u7F8E\u98DF\u3001\u5BA0\u7269\u3001\u6570\u7801\u3001\u5BB6\u5C45",
    howto: "\u63D0\u53D6\u5BF9\u8C61\u7279\u6027\u5F62\u6210\u6027\u683C\uFF1B\u89D2\u8272\u5173\u7CFB\u4E0E\u4EA7\u54C1\u529F\u80FD\u5BF9\u5E94\uFF1B\u7EF4\u6301\u4E16\u754C\u89C2\u3002",
    cases: "\u9E21\u86CB\u4E0E\u756A\u8304\u60C5\u4FA3\uFF1BSiri\u548C\u624B\u673A\u58F3\uFF1B\u524D\u624B\u673A\u4E0E\u73B0\u624B\u673A\u5BF9\u8BDD\u3002",
    limit: "\u5BA0\u7269\u62CD\u6444\u4EE5\u798F\u5229\u4E3A\u5148\uFF1B\u54C1\u724C\u62DF\u4EBA\u5316\u4E0D\u80FD\u9020\u8C23\u6216\u6DF7\u6DC6\u5B98\u65B9\u8EAB\u4EFD\u3002"
  },
  {
    no: 21,
    name: "\u62DF\u7269\u5316",
    source: "\u7B2C62\u8282",
    mechanism: "\u628A\u4EBA\u6216\u4EBA\u7684\u72B6\u6001\u5F53\u4F5C\u67D0\u79CD\u7269\u54C1/\u5546\u54C1\u6765\u8868\u8FBE",
    formula: "\u4EBA\u7684\u5904\u5883 \u2192 \u7269\u7684\u673A\u5236 \u2192 \u8352\u8BDE\u5BF9\u5E94 \u2192 \u60C5\u7EEA/\u7B11\u70B9",
    fit: "\u5065\u8EAB\u3001\u751F\u6D3B\u3001\u5BA0\u7269\u3001\u6BB5\u5B50",
    howto: "\u627E\u5230\u7ED3\u6784\u76F8\u4F3C\u800C\u975E\u53EA\u6362\u540D\u8BCD\uFF1B\u7528\u9053\u5177\u548C\u52A8\u4F5C\u628A\u6BD4\u55BB\u62CD\u51FA\u6765\uFF1B\u4FDD\u6301\u6613\u61C2\u3002",
    cases: "\u4EBA\u7684\u7CBE\u795E\u72B6\u6001\u88AB\u5F53\u6210\u7279\u6B8A\u6760\u94C3\u4EA7\u54C1\u7B49\u8352\u8BDE\u8BBE\u5B9A\u3002",
    limit: "\u907F\u514D\u7269\u5316\u3001\u6027\u522B\u6B67\u89C6\u548C\u8EAB\u4F53\u7F9E\u8FB1\uFF1B\u4E0D\u62FF\u75BE\u75C5\u4E0E\u5F31\u52BF\u7FA4\u4F53\u505A\u7B11\u70B9\u3002"
  },
  {
    no: 22,
    name: "\u884C\u4E1A\u907F\u5751",
    source: "\u7B2C63\u8282",
    mechanism: "\u5229\u7528\u8D8B\u5229\u907F\u5BB3\uFF0C\u5E2E\u52A9\u7528\u6237\u907F\u514D\u660E\u786E\u635F\u5931",
    formula: "\u70B9\u540D\u5751 \u2192 \u540E\u679C \u2192 \u8BC6\u522B\u4FE1\u53F7 \u2192 \u66FF\u4EE3\u65B9\u6848",
    fit: "\u6240\u6709\u6709\u51B3\u7B56\u6210\u672C\u7684\u884C\u4E1A",
    howto: "\u805A\u7126\u9AD8\u9891\u5927\u635F\u5931\uFF1B\u7ED9\u8BC6\u522B\u65B9\u6CD5\u800C\u975E\u53EA\u5236\u9020\u6050\u60E7\uFF1B\u8BC1\u636E\u53EF\u6838\u9A8C\u3002",
    cases: "\u73E0\u5B9D\u6750\u8D28\u8BEF\u533A\uFF1B\u8FD0\u8425\u65B0\u624B\u5751\uFF1B\u533B\u7F8E\u975E\u6CD5\u9879\u76EE\uFF1B\u6D17\u62A4\u9009\u62E9\u3002",
    limit: "\u4E0D\u5F97\u8BFD\u8C24\u54C1\u724C\u3001\u5938\u5927\u6210\u672C\u6216\u7ED9\u65E0\u8D44\u8D28\u533B\u7597\u5EFA\u8BAE\uFF1B\u4EF7\u683C\u4E0E\u6CD5\u89C4\u8981\u6CE8\u660E\u65F6\u6548\u3002"
  },
  {
    no: 23,
    name: "\u5185\u5E55\u63ED\u79D8",
    source: "\u7B2C64\u8282",
    mechanism: "\u89E3\u91CA\u884C\u4E1A\u5229\u76CA\u94FE\u3001\u6D41\u7A0B\u548C\u9690\u853D\u5957\u8DEF",
    formula: "\u8868\u9762\u73B0\u8C61 \u2192 \u5E55\u540E\u673A\u5236 \u2192 \u8C01\u83B7\u5229/\u8C01\u627F\u62C5 \u2192 \u8BC6\u522B\u4E0E\u5E94\u5BF9",
    fit: "\u670D\u88C5\u3001\u4E8C\u624B\u8F66\u3001\u79DF\u8F66\u3001\u52A0\u76DF",
    howto: "\u9009\u62E9\u516C\u4F17\u5229\u76CA\u76F8\u5173\u95EE\u9898\uFF1B\u533A\u5206\u4E8B\u5B9E\u3001\u63A8\u6D4B\u548C\u4E2A\u6848\uFF1B\u63D0\u4F9B\u8BC1\u636E\u4E0E\u9632\u8303\u3002",
    cases: "\u7F51\u7EA2\u5E97\u4F9B\u5E94\u94FE\uFF1B\u4E8C\u624B\u8F66\u4F4E\u4EF7\u5F15\u6D41\uFF1B\u5FEB\u62DB\u52A0\u76DF\u5957\u8DEF\u3002",
    limit: "\u9AD8\u8BFD\u8C24\u98CE\u9669\uFF1B\u533F\u540D\u4E0D\u8DB3\u4EE5\u66FF\u4EE3\u8BC1\u636E\uFF0C\u9700\u6CD5\u5F8B\u5BA1\u67E5\u548C\u5F53\u4E8B\u65B9\u56DE\u5E94\u7A7A\u95F4\u3002"
  },
  {
    no: 24,
    name: "\u61D2\u4EBA\u5B66\u4E60",
    source: "\u7B2C65\u8282",
    mechanism: "\u627F\u8BFA\u6781\u4F4E\u65F6\u95F4\u6216\u6B65\u9AA4\u6210\u672C\uFF0C\u5FEB\u901F\u4EA4\u4ED8\u4E00\u4E2A\u5C0F\u7ED3\u679C",
    formula: "\u4F4E\u95E8\u69DB\u627F\u8BFA \u2192 \u6F14\u793A \u2192 \u7ACB\u5373\u9A8C\u8BC1 \u2192 \u5EF6\u4F38",
    fit: "\u6280\u80FD\u3001\u5065\u5EB7\u5E38\u8BC6\u3001\u7F8E\u5986\u3001\u7F8E\u98DF\u3001\u8BFB\u4E66",
    howto: "\u628A\u590D\u6742\u76EE\u6807\u5207\u6210\u4E00\u4E2A\u5FAE\u6280\u80FD\uFF1B\u65F6\u95F4\u627F\u8BFA\u771F\u5B9E\uFF1B\u5148\u7ED3\u679C\u540E\u539F\u7406\u3002",
    cases: "\u4E00\u5206\u949F\u5316\u5986\u6280\u5DE7\uFF1B\u4E00\u5206\u949F\u83DC\u8C31\uFF1B\u4E09\u5206\u949F\u8BFB\u4E00\u672C\u4E66\u3002",
    limit: "\u4E0D\u8981\u7528\u201C\u4E09\u5206\u949F\u201D\u5305\u88C515\u5206\u949F\u6216\u4EE5\u865A\u5047\u901F\u6210\u627F\u8BFA\u8BEF\u5BFC\uFF1B\u5065\u5EB7\u81EA\u6D4B\u4E0D\u80FD\u66FF\u4EE3\u8BCA\u65AD\u3002"
  },
  {
    no: 25,
    name: "\u66B4\u8E81\u6001\u5EA6",
    source: "\u7B2C66\u8282",
    mechanism: "\u7528\u5F3A\u70C8\u3001\u7A33\u5B9A\u7684\u60C5\u7EEA\u91CD\u65B0\u6F14\u7ECE\u884C\u4E1A\u77E5\u8BC6\u6216\u89C2\u70B9",
    formula: "\u75DB\u70B9\u4E8B\u4EF6 \u2192 \u9AD8\u60C5\u7EEA\u8868\u8FBE \u2192 \u5E72\u8D27\u5224\u65AD \u2192 \u884C\u52A8\u51FA\u53E3",
    fit: "\u6559\u80B2\u3001\u5DE5\u7A0B\u3001\u8BC4\u8BBA\u3001\u884C\u4E1A\u5410\u69FD",
    howto: "\u60C5\u7EEA\u6765\u81EA\u771F\u5B9E\u7ACB\u573A\uFF1B\u91CD\u97F3\u3001\u505C\u987F\u3001\u8868\u60C5\u3001\u955C\u5934\u5171\u540C\u914D\u5408\uFF1B\u5185\u5BB9\u4ECD\u8981\u542C\u5F97\u6E05\u3002",
    cases: "\u66B4\u8E81\u8BB2\u7F8E\u672F\u8054\u8003\u3001\u7559\u5B66\u5EFA\u8BAE\u3001\u5DE5\u7A0B\u8003\u8BC1\u3002",
    limit: "\u4E0D\u80FD\u8FB1\u9A82\u4E2A\u4F53\u3001\u717D\u52A8\u7F51\u66B4\u6216\u7528\u60C5\u7EEA\u906E\u76D6\u9519\u8BEF\u4E8B\u5B9E\uFF1B\u5E76\u975E\u6240\u6709\u4EBA\u683C\u90FD\u9002\u5408\u3002"
  },
  {
    no: 26,
    name: "\u63A8\u8350\u5EFA\u8BAE",
    source: "\u7B2C67\u8282",
    mechanism: "\u5411\u76EE\u6807\u4EBA\u7FA4\u7B5B\u9009\u503C\u5F97\u9009\u62E9\u7684\u4EBA\u4E8B\u7269",
    formula: "\u5708\u4EBA/\u5229\u76CA \u2192 \u6E05\u5355 \u2192 \u6BCF\u9879\u7406\u7531 \u2192 \u9002\u7528\u4E0E\u4E0D\u9002\u7528",
    fit: "\u5DE5\u5177\u3001\u8D26\u53F7\u3001\u4E66\u5F71\u3001\u4EA7\u54C1",
    howto: "\u5EFA\u7ACB\u7EDF\u4E00\u8BC4\u9009\u6807\u51C6\uFF1B\u8BF4\u6E05\u7406\u7531\u3001\u6761\u4EF6\u4E0E\u66FF\u4EE3\u9879\uFF1B\u53EF\u505A10\u201420\u6761\u7CFB\u5217\u3002",
    cases: "\u65B0\u5A92\u4F53\u7F51\u7AD9\uFF1B\u641E\u94B1\u535A\u4E3B\uFF1B\u5E73\u4EF7\u62A4\u80A4\uFF1B\u6210\u957F\u4E66\u5F71\u3002",
    limit: "\u62AB\u9732\u4F63\u91D1\u548C\u5546\u4E1A\u5408\u4F5C\uFF1B\u907F\u514D\u672A\u7ECF\u4F53\u9A8C\u7684\u786C\u63A8\u53CA\u865A\u5047\u529F\u6548\u3002"
  },
  {
    no: 27,
    name: "\u4E92\u6362\u8EAB\u4EFD",
    source: "\u7B2C68\u8282",
    mechanism: "\u8BA9\u4EBA\u7269\u627F\u62C5\u4E0E\u539F\u8EAB\u4EFD\u4E0D\u540C\u7684\u793E\u4F1A\u89D2\u8272",
    formula: "\u8EAB\u4EFDA\u8FDB\u5165\u89D2\u8272B \u2192 \u6A21\u4EFF\u5178\u578B\u884C\u4E3A \u2192 \u51B2\u7A81/\u6D1E\u5BDF \u2192 \u56DE\u5F52",
    fit: "\u804C\u573A\u3001\u63A2\u5E97\u3001\u5173\u7CFB\u3001\u5267\u60C5",
    howto: "\u6293\u89D2\u8272\u7684\u52A8\u4F5C\u903B\u8F91\u800C\u975E\u53EA\u6362\u670D\u88C5\uFF1B\u7528\u4E92\u6362\u63ED\u793A\u4F53\u9A8C\u5DEE\u5F02\uFF1B\u8868\u6F14\u81EA\u7136\u3002",
    cases: "\u5973\u6027\u6F14\u91D1\u878D\u7537\u7EA6\u4F1A\uFF1B\u987E\u5BA2\u82B1\u94B1\u5F53\u4E00\u5929\u82B1\u5E97\u8001\u677F\uFF1B\u8001\u677F\u5458\u5DE5\u4E92\u6362\u3002",
    limit: "\u907F\u514D\u804C\u4E1A\u3001\u6027\u522B\u4E0E\u9636\u5C42\u523B\u677F\u5370\u8C61\uFF1B\u4E0D\u5192\u5145\u4E13\u4E1A\u4EBA\u58EB\u505A\u771F\u5B9E\u5EFA\u8BAE\u3002"
  },
  {
    no: 28,
    name: "\u6000\u65E7\u590D\u53E4",
    source: "\u7B2C69\u8282",
    mechanism: "\u7528\u8001\u6B4C\u3001\u65E7\u7269\u3001\u670D\u5316\u9053\u548C\u5E74\u4EE3\u6545\u4E8B\u5524\u8D77\u8BB0\u5FC6",
    formula: "\u5E74\u4EE3\u5165\u53E3 \u2192 \u7EC6\u8282\u590D\u539F \u2192 \u5F53\u65F6\u4F53\u9A8C \u2192 \u4ECA\u6614\u8FDE\u63A5",
    fit: "\u97F3\u4E50\u3001\u7F8E\u98DF\u3001\u670D\u88C5\u3001\u63A2\u5E97\u3001\u5730\u65B9\u6587\u5316",
    howto: "\u9501\u5B9A\u5177\u4F53\u5E74\u4EE3\u4E0E\u4EBA\u7FA4\uFF1B\u7EC6\u8282\u8003\u636E\uFF1B\u7528\u4E2A\u4EBA\u8BB0\u5FC6\u6216\u8001\u5E97\u4EBA\u7269\u589E\u52A0\u771F\u5B9E\u6027\u3002",
    cases: "94\u5E74\u534E\u8BED\u4E50\u575B\uFF1B\u590D\u53E4\u7F8E\u98DF\u670D\u5316\u9053\uFF1B\u63A230/50\u5E74\u8001\u5E97\u3002",
    limit: "\u8001\u6B4C\u3001\u5F71\u89C6\u7D20\u6750\u9700\u7248\u6743\uFF1B\u907F\u514D\u628A\u6000\u65E7\u53D8\u6210\u4E8B\u5B9E\u9519\u8BEF\u6216\u5355\u7EAF\u6EE4\u955C\u3002"
  },
  {
    no: 29,
    name: "\u5410\u69FD\u5947\u8469\u73B0\u8C61",
    source: "\u7B2C70\u8282",
    mechanism: "\u9488\u5BF9\u76EE\u6807\u7FA4\u4F53\u5171\u540C\u906D\u9047\u7684\u4E0D\u5408\u7406\u73B0\u8C61\u8868\u8FBE\u6001\u5EA6",
    formula: "\u5177\u4F53\u73B0\u8C61 \u2192 \u53D7\u5BB3\u573A\u666F \u2192 \u4E3A\u4EC0\u4E48\u8352\u8C2C \u2192 \u5EFA\u8BAE/\u63D0\u95EE",
    fit: "\u670D\u88C5\u3001\u6559\u80B2\u3001\u804C\u573A\u3001\u5730\u57DF\u751F\u6D3B",
    howto: "\u4ECE\u771F\u5B9E\u7ECF\u5386\u51FA\u53D1\uFF1B\u968F\u624B\u62CD\u53EF\u5F3A\u5316\u5F53\u4E0B\u60C5\u7EEA\uFF1B\u628A\u77DB\u5934\u5BF9\u51C6\u673A\u5236\u800C\u975E\u5F31\u8005\u3002",
    cases: "\u5C3A\u7801\u7126\u8651\uFF1B\u4E1C\u5317\u4E0D\u5B9E\u7528\u7A7F\u642D\uFF1B\u62FC\u97F3\u4E89\u8BAE\uFF1B\u5BB6\u957F\u7FA4\u5237\u5C4F\u3002",
    limit: "\u6838\u5B9E\u89C4\u5219\u4E0E\u4E8B\u5B9E\uFF1B\u907F\u514D\u5730\u57DF\u653B\u51FB\u3001\u9020\u8C23\u3001\u70B9\u540D\u7F51\u66B4\u548C\u7EAF\u8D1F\u80FD\u91CF\u3002"
  },
  {
    no: 30,
    name: "\u89D2\u8272\u626E\u6F14",
    source: "\u7B2C71\u8282",
    mechanism: "\u901A\u8FC7\u4E24\u4E2A\u6216\u591A\u4E2A\u660E\u786E\u89D2\u8272\u5236\u9020\u573A\u666F\u4E0E\u620F\u5267\u5F20\u529B",
    formula: "\u89D2\u8272\u76EE\u6807\u51B2\u7A81 \u2192 \u5BF9\u8BDD\u5347\u7EA7 \u2192 \u53CD\u8F6C/\u77E5\u8BC6 \u2192 \u56DE\u6536",
    fit: "\u533B\u7597\u79D1\u666E\u3001\u804C\u573A\u3001\u53E4\u88C5\u3001\u60C5\u4FA3\u3001\u54C1\u724C",
    howto: "\u89D2\u8272\u6709\u4E0D\u540C\u6B32\u671B\uFF1B\u9020\u578B\u3001\u8BED\u8A00\u3001\u673A\u4F4D\u6E05\u695A\uFF1B\u6BCF\u53E5\u63A8\u52A8\u51B2\u7A81\u3002",
    cases: "\u533B\u751F\u60A3\u8005\uFF1B\u53E4\u88C5\u7A7F\u8D8A\uFF1B\u5458\u5DE5\u9886\u5BFC\uFF1B\u5BB6\u5EAD\u5BAB\u5EF7\u6DF7\u642D\u3002",
    limit: "\u533B\u7597\u89D2\u8272\u4E0D\u5F97\u5192\u5145\u8D44\u8D28\uFF1B\u5236\u670D\u4E0E\u804C\u4E1A\u5185\u5BB9\u907F\u514D\u8BEF\u5BFC\uFF0C\u5267\u60C5\u9700\u5408\u89C4\u3002"
  },
  {
    no: 31,
    name: "\u5357\u5317/\u5730\u57DF\u5DEE\u5F02",
    source: "\u7B2C72\u8282",
    mechanism: "\u6BD4\u8F83\u5730\u57DF\u8BED\u8A00\u3001\u4EF7\u683C\u3001\u4EFD\u91CF\u3001\u4E60\u60EF\u4E0E\u670D\u52A1",
    formula: "\u540C\u4E00\u4EFB\u52A1\u4E24\u5730\u505A \u2192 \u5DEE\u5F02\u53CD\u5E94 \u2192 \u539F\u56E0/\u6587\u5316 \u2192 \u4EA4\u6D41",
    fit: "\u7F8E\u98DF\u3001\u5E02\u573A\u3001\u5A5A\u4FD7\u3001\u751F\u6D3B\u670D\u52A1",
    howto: "\u9009\u62E9\u771F\u5B9E\u53EF\u89C2\u5BDF\u5DEE\u5F02\uFF1B\u8BA9\u4E0D\u540C\u5730\u57DF\u4EBA\u7269\u4E92\u52A8\uFF1B\u89E3\u91CA\u80CC\u666F\u800C\u975E\u53EA\u730E\u5947\u3002",
    cases: "\u5357\u65B9\u4EBA\u901B\u5317\u65B9\u65E9\u5E02\uFF1B\u5317\u65B9\u957F\u8F88\u901B\u5357\u65B9\u83DC\u5E02\u573A\u3002",
    limit: "\u4E2A\u6848\u4E0D\u4EE3\u8868\u5730\u533A\uFF1B\u907F\u514D\u5730\u57DF\u6B67\u89C6\u3001\u523B\u677F\u5316\u4E0E\u865A\u5047\u4EF7\u683C\u3002"
  },
  {
    no: 32,
    name: "\u6362\u4E2A\u89C6\u89D2",
    source: "\u7B2C73\u8282",
    mechanism: "\u6539\u53D8\u6444\u50CF\u673A\u4F4D\u7F6E\u6216\u53D9\u4E8B\u4E3B\u4F53\uFF0C\u83B7\u5F97\u65B0\u9C9C\u611F\u548C\u4EE3\u5165",
    formula: "\u5E38\u89C4\u4E8B\u4EF6 + \u65B0POV \u2192 \u65B0\u4FE1\u606F/\u60C5\u7EEA",
    fit: "\u5BA0\u7269\u3001\u4EB2\u5B50\u3001\u670D\u52A1\u3001\u751F\u6D3B\u7EAA\u5F55",
    howto: "\u9009\u7B2C\u4E00\u89C6\u89D2\u3001\u5BA0\u7269\u89C6\u89D2\u3001\u76D1\u63A7\u5E7F\u89D2\u3001\u7269\u4F53\u89C6\u89D2\uFF1B\u8BA9\u89C6\u89D2\u63D0\u4F9B\u5E38\u89C4\u955C\u5934\u770B\u4E0D\u5230\u7684\u4FE1\u606F\u3002",
    cases: "\u6444\u50CF\u5934\u6302\u5BA0\u7269\uFF1B\u5B69\u5B50\u7B2C\u4E00\u89C6\u89D2\u9001\u82B1\uFF1B\u771F\u5B9E\u76D1\u63A7\u5E7F\u89D2\u3002",
    limit: "\u76D1\u63A7\u4E0E\u5077\u62CD\u6D89\u53CA\u9690\u79C1\uFF1B\u56FA\u5B9A\u8BBE\u5907\u5B89\u5168\uFF1B\u4E0D\u8981\u628A\u6446\u62CD\u4F2A\u88C5\u6210\u771F\u5B9E\u76D1\u63A7\u3002"
  },
  {
    no: 33,
    name: "\u5BA0\u59BB/\u5BA0\u592B\u53CD\u5DEE",
    source: "\u7B2C74\u8282",
    mechanism: "\u5634\u4E0A\u5F3A\u786C\uFF0C\u884C\u52A8\u6E29\u67D4\uFF0C\u7528\u53CD\u5DEE\u5C55\u793A\u5173\u7231",
    formula: "\u786C\u8BDD\u5851\u9020\u8868\u8C61 \u2192 \u5BB6\u52A1/\u80B2\u513F\u884C\u52A8 \u2192 \u7EC6\u8282\u8BC1\u660E \u2192 \u6E29\u60C5\u56DE\u6536",
    fit: "\u5BB6\u5EAD\u3001\u80B2\u513F\u3001\u751F\u6D3B\u5E26\u8D27",
    howto: "\u8BA9\u884C\u52A8\u6301\u7EED\u4E14\u5177\u4F53\uFF1B\u4EA7\u54C1\u53EA\u5728\u771F\u5B9E\u95EE\u9898\u5904\u51FA\u73B0\uFF1B\u53EF\u53CD\u5411\u4E3A\u5BA0\u592B\u4F46\u4E0D\u8D2C\u4F4E\u4EFB\u4F55\u4E00\u65B9\u3002",
    cases: "\u58F0\u79F0\u5BB6\u5EAD\u5730\u4F4D\u9AD8\uFF0C\u5B9E\u9645\u4EA4\u5DE5\u8D44\u3001\u505A\u5BB6\u52A1\u3001\u534A\u591C\u5582\u5976\u3002",
    limit: "\u4E0D\u9F13\u52B1\u63A7\u5236\u3001\u6027\u522B\u523B\u677F\u548C\u6446\u62CD\u5BB6\u5EAD\u51B2\u7A81\uFF1B\u513F\u7AE5\u4E0E\u4F34\u4FA3\u540C\u610F\u4F18\u5148\u3002"
  },
  {
    no: 34,
    name: "\u63A5\u53D7\u7F51\u53CB\u6311\u6218",
    source: "\u7B2C75\u8282",
    mechanism: "\u628A\u8BC4\u8BBA\u533A\u8981\u6C42\u8F6C\u5316\u4E3A\u4E0B\u4E00\u96C6\u4EFB\u52A1",
    formula: "\u5C55\u793A\u6311\u6218 \u2192 \u89C4\u5219/\u8D4C\u6CE8 \u2192 \u6267\u884C \u2192 \u7ED3\u679C \u2192 \u5F81\u96C6\u4E0B\u4E00\u9898",
    fit: "\u8FD0\u52A8\u3001\u79DF\u623F\u3001\u63A2\u5E97\u3001\u8FD0\u8425\u3001\u65C5\u884C",
    howto: "\u6311\u6218\u53EF\u5B8C\u6210\u4F46\u6709\u4E0D\u786E\u5B9A\u6027\uFF1B\u89C4\u5219\u6E05\u695A\uFF1B\u8FC7\u7A0B\u6709\u51B2\u7A81\u548C\u53CD\u8F6C\uFF1B\u8FDE\u7EED\u680F\u76EE\u5316\u3002",
    cases: "\u63B0\u624B\u8155\u53CC\u5411\u653E\u6C34\uFF1B\u966A\u7F51\u53CB\u79DF\u623F\uFF1B\u5E2E\u7C89\u4E1D\u5230\u5F53\u5730\u505A\u8D26\u53F7\u3002",
    limit: "\u4E0D\u63A5\u53D7\u8FDD\u6CD5\u3001\u5371\u9669\u3001\u7F9E\u8FB1\u6216\u5DE8\u989D\u635F\u5931\u6311\u6218\uFF1B\u5546\u4E1A\u5408\u4F5C\u9700\u62AB\u9732\u3002"
  },
  {
    no: 35,
    name: "\u8857\u5934\u91C7\u8BBF",
    source: "\u7B2C76\u8282",
    mechanism: "\u7528\u771F\u5B9E\u4EBA\u7269\u56DE\u7B54\u548C\u73B0\u573A\u53CD\u5E94\u521B\u9020\u5185\u5BB9",
    formula: "\u4E00\u53E5\u597D\u95EE\u9898 \u2192 \u8FFD\u95EE \u2192 \u4EBA\u7269\u6545\u4E8B/\u89C2\u70B9 \u2192 \u884C\u4E1A\u8FDE\u63A5",
    fit: "\u79DF\u623F\u3001\u60C5\u611F\u3001\u6570\u7801\u3001\u7F8E\u98DF\u3001\u7A7F\u642D",
    howto: "\u95EE\u9898\u77ED\u3001\u5F00\u653E\u4F46\u4E0D\u7A7A\u6CDB\uFF1B\u8FFD\u95EE\u5177\u4F53\u7EC6\u8282\uFF1B\u51C6\u5907\u62D2\u7EDD\u7387\uFF1B\u53EF\u7531\u56DE\u7B54\u8FDB\u5165\u4F53\u9A8C\u6216\u63A2\u8BBF\u3002",
    cases: "\u53C2\u89C2\u9AD8\u623F\u79DF\u4F4F\u5B85\uFF1B\u60C5\u611F\u9009\u62E9\uFF1B\u731C\u624B\u673A\uFF1B\u8DDF\u53D7\u8BBF\u8005\u56DE\u5BB6\u4E61\u5403\u7F8E\u98DF\u3002",
    limit: "\u5148\u5F81\u5F97\u62CD\u6444\u4E0E\u53D1\u5E03\u540C\u610F\uFF1B\u4E0D\u5F97\u8BF1\u5BFC\u3001\u65AD\u7AE0\u53D6\u4E49\u3001\u6CC4\u9732\u5730\u5740\u4E0E\u654F\u611F\u8EAB\u4EFD\u3002"
  },
  {
    no: 36,
    name: "\u51B7\u77E5\u8BC6",
    source: "\u7B2C77\u8282",
    mechanism: "\u63D0\u4F9B\u9C9C\u4E3A\u4EBA\u77E5\u3001\u53CD\u5E38\u8BC6\u4E14\u53EF\u8F6C\u8FF0\u7684\u4FE1\u606F",
    formula: "\u53CD\u5E38\u8BC6\u7ED3\u8BBA \u2192 \u8BC1\u636E/\u4F8B\u5B50 \u2192 \u539F\u7406 \u2192 \u5E94\u7528",
    fit: "\u5386\u53F2\u3001\u73E0\u5B9D\u3001\u6CD5\u5F8B\u3001\u751F\u6D3B\u3001\u884C\u4E1A\u77E5\u8BC6",
    howto: "\u4E00\u6761\u53EA\u8BB2\u4E00\u4E2A\u60CA\u8BB6\u70B9\uFF1B\u6765\u6E90\u53EF\u6838\u67E5\uFF1B\u8BBE\u8BA1\u53EF\u6536\u85CF\u7684\u8868\u683C\u6216\u6E05\u5355\u3002",
    cases: "\u7389\u77F3\u5192\u5145\u5957\u8DEF\uFF1B\u5386\u53F2\u65F6\u95F4\u91CD\u53E0\uFF1B\u5408\u6CD5\u67E5\u8BE2\u6E20\u9053\u3002",
    limit: "\u51B7\u77E5\u8BC6\u6700\u6613\u4F20\u64AD\u8C23\u8A00\uFF1B\u5386\u53F2\u3001\u5065\u5EB7\u3001\u6CD5\u5F8B\u548C\u6570\u636E\u5FC5\u987B\u4EA4\u53C9\u6838\u9A8C\u5E76\u6CE8\u660E\u6761\u4EF6\u3002"
  },
  {
    no: 37,
    name: "\u8D60\u9001\uFF1A\u8EAB\u4EFD\u53CD\u5DEE",
    source: "\u7B2C78\u8282",
    mechanism: "\u8BA9\u804C\u4E1A/\u6027\u522B/\u73AF\u5883\u9884\u671F\u4E0E\u5B9E\u9645\u884C\u4E3A\u5F62\u6210\u53CD\u5DEE",
    formula: "\u8EAB\u4EFD\u9884\u671FA \u2192 \u884C\u4E3AB \u2192 \u73AF\u5883\u81EA\u6D3D \u2192 \u80FD\u529B/\u60C5\u7EEA\u7ED3\u679C",
    fit: "\u97F3\u4E50\u3001\u670D\u88C5\u3001\u804C\u4E1A\u77E5\u8BC6\u3001\u624D\u827A",
    howto: "\u5148\u786E\u8BA4\u5927\u4F17\u5BF9\u8EAB\u4EFD\u7684\u9884\u671F\uFF1B\u884C\u4E3A\u53CD\u5DEE\u8981\u660E\u663E\uFF1B\u670D\u88C5\u4E0E\u573A\u666F\u652F\u6491\u8EAB\u4EFD\u771F\u5B9E\u6027\u3002",
    cases: "\u4FDD\u5B89\u5531\u6B4C\uFF1B\u5B66\u751F\u88C5\u5531\u9752\u6625\u56F0\u60D1\uFF1B\u7537\u751F\u8BC4\u5973\u88C5\uFF1B\u533B\u751F\u5F62\u8C61\u5531\u60C5\u6B4C\u3002",
    limit: "\u4E0D\u80FD\u5047\u5192\u771F\u5B9E\u804C\u4E1A\u8D44\u8D28\u3001\u6D88\u8D39\u5F31\u52BF\u8EAB\u4EFD\u6216\u5236\u9020\u6027\u522B\u7F9E\u8FB1\u3002"
  }
];
var SELECTION_MATRIX = [
  {
    condition: "\u5355\u4EBA\u3001\u4F4E\u9884\u7B97\u3001\u4E13\u4E1A\u5F3A",
    detect: "\u56E2\u961F\u662F\u4E00\u4EBA\u5168\u5305 / \u5355\u6761\u9884\u7B97 0-500 / \u6709\u8D44\u8D28\u6216\u505A\u4E86\u5F88\u591A\u5E74",
    prefer: ["\u884C\u4E1A\u907F\u5751", "\u5185\u5E55\u63ED\u79D8", "\u51B7\u77E5\u8BC6", "\u63A8\u8350\u5EFA\u8BAE", "\u66B4\u8E81\u6001\u5EA6", "Rap+\u884C\u4E1A"],
    defer: "\u8857\u8BBF\u3001\u591A\u4EBA\u5267\u60C5\u3001\u5927\u578B\u6539\u9020"
  },
  {
    condition: "\u6709\u4EA7\u54C1 / \u95E8\u5E97",
    detect: "\u6863\u6848\u91CC\u6709\u95E8\u5E97\u3001\u6709\u4EA7\u54C1\u54C1\u7C7B\u3001\u53D8\u73B0\u65B9\u5F0F\u542B\u5230\u5E97\u6D88\u8D39",
    prefer: ["\u60C5\u5883\u8FD8\u539F", "\u4EE5\u7269\u6362\u7269", "\u6B63\u786E\u505A\u6CD5VS\u9519\u8BEF\u505A\u6CD5", "\u8857\u5934\u91C7\u8BBF", "\u63A8\u8350\u5EFA\u8BAE"],
    defer: "\u4E0E\u8F6C\u5316\u65E0\u5173\u7684\u7EAF\u5A31\u4E50"
  },
  {
    condition: "\u6709\u8868\u6F14\u4E0E\u642D\u6863",
    detect: "\u56E2\u961F\u4E0D\u6B62\u4E00\u4EBA / \u8D44\u6E90\u91CC\u5199\u4E86\u6709\u4EBA\u80FD\u914D\u5408\u51FA\u955C",
    prefer: ["\u4E00\u4EBA\u5206\u9970\u591A\u89D2", "\u89D2\u8272\u626E\u6F14", "\u6574\u86CA", "\u6A21\u4EFF\u7535\u5F71\u7247\u6BB5", "\u4E92\u6362\u8EAB\u4EFD"],
    defer: "\u53EA\u505A\u9759\u6001\u77E5\u8BC6\u53E3\u64AD"
  },
  {
    condition: "\u6709\u771F\u5B9E\u9879\u76EE\u8FC7\u7A0B",
    detect: "\u6709\u5DE5\u4F5C\u73B0\u573A\u53EF\u62CD\uFF1A\u8FDB\u8D27\u3001\u65BD\u5DE5\u3001\u670D\u52A1\u3001\u552E\u540E",
    prefer: ["\u5BF9\u6BD4\u6539\u9020", "\u63A5\u53D7\u7F51\u53CB\u6311\u6218", "\u4E92\u8054\u7F51\u5634\u66FF/\u66FF\u7F51\u53CB\u505A", "\u626E\u732A\u5403\u864E"],
    defer: "\u7F16\u9020\u6210\u529F\u7ED3\u679C"
  },
  {
    condition: "\u64C5\u957F\u6545\u4E8B / \u6587\u6848",
    detect: '\u6570\u636E\u6700\u597D\u7684\u5185\u5BB9\u7C7B\u578B\u662F"\u8BB2\u6545\u4E8B/\u8BB2\u7ECF\u5386" / \u5185\u5BB9\u98CE\u683C\u504F\u60C5\u611F',
    prefer: ["\u501F\u7269\u55BB\u4EBA", "\u4E00\u53E5\u8BDD\u8BBE\u5B9A\u6545\u4E8B\u611F", "\u52A0\u5165\u4EBA\u7269\u5173\u7CFB", "\u6000\u65E7\u590D\u53E4", "\u5BA0\u59BB/\u5BA0\u592B\u53CD\u5DEE"],
    defer: "\u9AD8\u9891\u786C\u5E72\u8D27"
  }
];
var BY_NAME = new Map(GROWTH_TACTICS.map((t) => [t.name, t]));

// .tmp/content-audit-production_20261008/lib/opening-cards.ts
var OPENING_CARDS = [
  {
    no: 1,
    name: "\u5708\u5B9A\u4EBA\u7FA4",
    category: "\u76F8\u5173\u6027",
    psychology: "\u76F4\u63A5\u70B9\u540D\u76EE\u6807\u89C2\u4F17\uFF0C\u8BA9\u5176\u4EA7\u751F\u201C\u5728\u8BF4\u6211\u201D\u7684\u81EA\u6211\u5173\u8054",
    formula: "\u4EBA\u7FA4\u6807\u7B7E + \u75DB\u70B9/\u6B32\u671B + \u7EE7\u7EED\u89C2\u770B\u7406\u7531",
    howto: "\u5708\u4EBA\u4E0D\u80FD\u5355\u72EC\u6210\u7ACB\uFF0C\u540E\u9762\u5FC5\u987B\u63A5\u597D\u5947\u3001\u635F\u5931\u3001\u5229\u76CA\u6216\u89E3\u51B3\u65B9\u6848\u3002\u53EF\u7528\u6027\u522B\u3001\u804C\u4E1A\u3001\u9636\u6BB5\u3001\u5904\u5883\u3001\u5730\u57DF\u3001\u661F\u5EA7\u7B49\u6807\u7B7E\uFF0C\u4F46\u6807\u7B7E\u8D8A\u7A84\uFF0C\u5185\u5BB9\u8D8A\u8981\u7CBE\u51C6\u3002",
    cases: "\u65B0\u624B\u505A\u6296\u97F3\uFF0C\u5343\u4E07\u522B\u4E00\u4E0A\u6765\u5C31\u53D1\u89C6\u9891\uFF1B\u5FAE\u80D6\u5973\u751F\u6700\u96BE\u4E70\u88E4\u5B50\u7684\u4E09\u4E2A\u95EE\u9898\u3002",
    combo: "\u5708\u5B9A\u4EBA\u7FA4+\u76F4\u51FB\u75DB\u70B9/\u8B66\u544A\u907F\u5751/\u9AD8\u4EF7\u503C\u5C55\u793A",
    risk: "\u7C97\u66B4\u8D34\u6807\u7B7E\u3001\u6B67\u89C6\u7FA4\u4F53\u3001\u5708\u5F97\u592A\u7A84\u5374\u6CA1\u6709\u7CBE\u51C6\u5206\u53D1\u3002"
  },
  {
    no: 2,
    name: "\u76F4\u63A5\u63D0\u95EE",
    category: "\u76F8\u5173\u6027",
    psychology: "\u6A21\u62DF\u9762\u5BF9\u9762\u5BF9\u8BDD\uFF0C\u89E6\u53D1\u89C2\u4F17\u4E0B\u610F\u8BC6\u56DE\u7B54\uFF0C\u518D\u7528\u4FE1\u606F\u7F3A\u53E3\u4FDD\u6301\u671F\u5F85",
    formula: "\u95EE\u9898 + \u610F\u5916\u4E8B\u5B9E/\u51B2\u7A81 + \u7B54\u6848\u627F\u8BFA",
    howto: "\u201C\u4F60\u77E5\u9053\u5417\u201D\u672C\u8EAB\u6CA1\u6709\u529B\u91CF\uFF0C\u771F\u6B63\u7684\u94A9\u5B50\u662F\u95EE\u9898\u80CC\u540E\u7684\u597D\u5947\u3002\u95EE\u9898\u8981\u5177\u4F53\u3001\u6709\u7B54\u6848\uFF0C\u5E76\u8BA9\u76EE\u6807\u89C2\u4F17\u613F\u610F\u5728\u8111\u5185\u4F5C\u7B54\u3002",
    cases: "\u4F60\u53EF\u80FD\u60F3\u4E0D\u5230Mate60\u5F71\u54CD\u6709\u591A\u5927\uFF0C\u56E0\u4E3A\u6211\u6240\u5728\u516C\u53F8\u90FD\u6682\u505C\u88C1\u5458\u4E86\uFF1B\u4E3A\u4EC0\u4E48\u5341\u6761\u6CA1\u706B\uFF0C\u552F\u72EC\u8FD9\u4E00\u6761\u6709190\u4E07\u70B9\u8D5E\uFF1F",
    combo: "\u76F4\u63A5\u63D0\u95EE+\u5BF9\u6BD4/\u6781\u9650\u6570\u5B57/\u5708\u5B9A\u4EBA\u7FA4",
    risk: "\u7A7A\u6CDB\u8BBE\u95EE\u3001\u95EE\u9898\u4E0E\u7528\u6237\u65E0\u5173\u3001\u6B63\u6587\u8FDF\u8FDF\u4E0D\u56DE\u7B54\u3002"
  },
  {
    no: 3,
    name: "\u81EA\u6211\u5426\u5B9A",
    category: "\u8BA4\u77E5\u7F3A\u53E3",
    psychology: "\u5148\u7ED9\u51FA\u539F\u9884\u671F\uFF0C\u518D\u4E3B\u52A8\u63A8\u7FFB\uFF0C\u5236\u9020\u201C\u5230\u5E95\u53D1\u751F\u4E86\u4EC0\u4E48\u201D\u7684\u8FDD\u80CC\u611F",
    formula: "\u6211\u672C\u4EE5\u4E3AA\uFF0C\u6CA1\u60F3\u5230B\uFF1B\u672C\u6765\u4E0D\u60F3\u8BF4\uFF0C\u4F46C",
    howto: "A\u5FC5\u987B\u7B26\u5408\u89C2\u4F17\u539F\u6709\u9884\u671F\uFF0CB\u5FC5\u987B\u66F4\u610F\u5916\uFF1B\u6B63\u6587\u8981\u89E3\u91CA\u8F6C\u53D8\u8BC1\u636E\u3002\u5B83\u4E0D\u662F\u60C5\u7EEA\u53E3\u5934\u7985\uFF0C\u800C\u662F\u8BA4\u77E5\u66F4\u65B0\u3002",
    cases: "\u6211\u4EE5\u4E3A\u6C7D\u8F66\u5E02\u573A\u5DF2\u7ECF\u591F\u75AF\u72C2\uFF0C\u6CA1\u60F3\u5230\u4E0B\u534A\u5E74\u9A6C\u81EA\u8FBE\u6380\u684C\u4E86\uFF1B\u672C\u6765\u4E0D\u60F3\u8BB2\u8463\u5B87\u8F89\uFF0C\u4F46\u770B\u5B8C\u5408\u4F53\u76F4\u64AD\u540E\u2026\u2026",
    combo: "\u81EA\u6211\u5426\u5B9A+\u53CD\u8BA4\u77E5/\u9AD8\u4EF7\u503C\u5C55\u793A",
    risk: "\u5047\u88C5\u72B9\u8C6B\u3001\u53CD\u590D\u540A\u80C3\u53E3\u3001B\u5E76\u4E0D\u610F\u5916\u3002"
  },
  {
    no: 4,
    name: "\u53CD\u8BA4\u77E5",
    category: "\u8BA4\u77E5\u7F3A\u53E3",
    psychology: "\u63D0\u51FA\u4E0E\u5927\u4F17\u5E38\u8BC6\u76F8\u53CD\u3001\u4F46\u80FD\u7528\u8BC1\u636E\u89E3\u91CA\u7684\u7ED3\u8BBA",
    formula: "\u5927\u4F17\u8BA4\u4E3AA \u2192 \u6211\u7684\u7ED3\u8BBA\u975EA/B \u2192 \u8BC1\u636E\u9884\u544A",
    howto: "\u5148\u5199\u51FA\u5927\u4F17\u8BA4\u77E5\uFF0C\u518D\u5BFB\u627E\u771F\u5B9E\u4F8B\u5916\u3001\u9690\u85CF\u6761\u4EF6\u6216\u56E0\u679C\u8BEF\u5224\u3002\u6CA1\u6709\u53EF\u9760\u8BBA\u8BC1\u7684\u201C\u53CD\u8BA4\u77E5\u201D\u53EA\u662F\u53CD\u667A\u3002\u7D20\u6750\u5E93\u5E94\u8BB0\u5F55\u7ED3\u8BBA\u3001\u8BC1\u636E\u3001\u9002\u7528\u8303\u56F4\u3002",
    cases: "\u76AE\u80A4\u597D\u574F\u4E0E\u5929\u5929\u6577\u8865\u6C34\u9762\u819C\u672A\u5FC5\u76F8\u5173\uFF1B\u4E00\u5F00\u4E1A\u5C31\u7206\u706B\u7684\u5E97\u4E3A\u4EC0\u4E48\u53CD\u800C\u53EF\u80FD\u66F4\u5371\u9669\uFF1F",
    combo: "\u53CD\u8BA4\u77E5+\u76F4\u63A5\u63D0\u95EE/\u5185\u5E55\u63ED\u79D8/\u4E0D\u540C\u89C6\u89D2",
    risk: "\u4E3A\u4E86\u51B2\u7A81\u6545\u610F\u8BF4\u9519\u3001\u7528\u4E2A\u4F8B\u63A8\u7FFB\u5E38\u8BC6\u3001\u533B\u5B66\u91D1\u878D\u9886\u57DF\u65E0\u8D44\u8D28\u65AD\u8A00\u3002"
  },
  {
    no: 5,
    name: "\u9AD8\u4EF7\u503C\u5C55\u793A",
    category: "\u4EF7\u503C\u4E0E\u635F\u5931",
    psychology: "\u628A\u663E\u8457\u6210\u679C\u3001\u7A00\u7F3A\u7ECF\u5386\u6216\u9AD8\u6210\u672C\u7814\u7A76\u524D\u7F6E\uFF0C\u8BC1\u660E\u540E\u6587\u503C\u5F97\u770B",
    formula: "\u7ED3\u679C/\u7ECF\u5386/\u6295\u5165 + \u8981\u8BB2\u7684\u65B9\u6CD5 + \u9002\u7528\u5BF9\u8C61",
    howto: "\u4EF7\u503C\u53EF\u4EE5\u662F\u6210\u679C\u3001\u635F\u5931\u6559\u8BAD\u3001\u65F6\u95F4\u6295\u5165\u3001\u8D44\u8D28\u6216\u7A00\u7F3A\u6837\u672C\uFF1B\u5FC5\u987B\u771F\u5B9E\u4E14\u4E0E\u540E\u6587\u76F4\u63A5\u76F8\u5173\u3002\u964D\u4F4E\u6267\u884C\u95E8\u69DB\u4E0D\u80FD\u9690\u7792\u5173\u952E\u6761\u4EF6\u3002",
    cases: "\u7626100\u65A4\u540E\u4E00\u5929\u600E\u4E48\u5403\uFF1B\u7528\u8D54\u8FC72000\u4E07\u7684\u7ECF\u5386\u8BB2\u4E09\u70B9\u8D5A\u94B1\u9053\u7406\uFF1B\u7814\u7A76\u5168\u90E8\u6837\u672C\u540E\u53D1\u73B0\u2026\u2026",
    combo: "\u9AD8\u4EF7\u503C\u5C55\u793A+\u5708\u5B9A\u4EBA\u7FA4/\u76D8\u70B9\u63A8\u8350",
    risk: "\u865A\u6784\u8D44\u5386\u3001\u53EA\u5C55\u793A\u7ED3\u679C\u4E0D\u8BB2\u6761\u4EF6\u3001\u590D\u5236\u522B\u4EBA\u7206\u6B3E\u539F\u53E5\u3002"
  },
  {
    no: 6,
    name: "\u76F4\u51FB\u75DB\u70B9",
    category: "\u76F8\u5173\u6027",
    psychology: "\u8BF4\u51FA\u7528\u6237\u6B63\u5728\u627F\u53D7\u3001\u8FEB\u5207\u60F3\u89E3\u51B3\u7684\u5177\u4F53\u56F0\u6270",
    formula: "\u60F3\u8981X\u4F46\u6015Y/\u6B63\u5728\u906D\u9047Z + \u4F4E\u95E8\u69DB\u89E3\u6CD5",
    howto: "\u75DB\u70B9\u8981\u6709\u5177\u4F53\u573A\u666F\u3001\u540E\u679C\u548C\u60C5\u7EEA\u3002\u8986\u76D6\u5E7F\u51B3\u5B9A\u6F5C\u5728\u6D41\u91CF\uFF0C\u75BC\u75DB\u6DF1\u51B3\u5B9A\u505C\u7559\u5F3A\u5EA6\uFF0C\u89E3\u51B3\u80FD\u529B\u51B3\u5B9A\u4FE1\u4EFB\u3002",
    cases: "\u9884\u7B97\u6709\u9650\u3001\u60F3\u6539\u5584\u53C8\u6015\u75BC\u7684\u59D0\u59B9\uFF1B\u80A9\u80DB\u9AA8\u7F1D\u75BC\u65F6\u5982\u4F55\u7F13\u89E3\uFF1B\u533B\u7F8E\u65B0\u4EBA\u6CA1\u4EBA\u5E26\u3001\u4E0D\u77E5\u5982\u4F55\u83B7\u5BA2\u3002",
    combo: "\u76F4\u51FB\u75DB\u70B9+\u5708\u4EBA/\u901F\u6210/\u8B66\u544A\u907F\u5751",
    risk: "\u5938\u5927\u75DB\u82E6\u3001\u5148\u5236\u9020\u7126\u8651\u518D\u5356\u552F\u4E00\u89E3\u3001\u9AD8\u98CE\u9669\u5065\u5EB7\u5EFA\u8BAE\u3002"
  },
  {
    no: 7,
    name: "\u635F\u5931\u538C\u6076",
    category: "\u4EF7\u503C\u4E0E\u635F\u5931",
    psychology: "\u5236\u9020\u5DF2\u77E5\u4E0E\u672A\u77E5\u4E4B\u95F4\u7684\u4FE1\u606F\u7F3A\u53E3\uFF0C\u8BA9\u4EBA\u611F\u89C9\u4E0D\u770B\u4F1A\u7EE7\u7EED\u5403\u4E8F",
    formula: "\u522B\u4EBA\u90FD\u544A\u8BC9\u4F60A\uFF0C\u5374\u6CA1\u4EBA\u544A\u8BC9\u4F60B\uFF1B\u95EE\u9898\u53D1\u751F\u662F\u56E0\u4E3A\u7F3A\u5C11C",
    howto: "\u660E\u786E\u7528\u6237\u4F1A\u5931\u53BB\u4EC0\u4E48\uFF1A\u94B1\u3001\u65F6\u95F4\u3001\u673A\u4F1A\u3001\u6548\u679C\u6216\u8BA4\u77E5\u3002\u968F\u540E\u5FC5\u987B\u4EA4\u4ED8\u7F3A\u5931\u7684B/C\uFF0C\u800C\u4E0D\u662F\u6C38\u8FDC\u85CF\u7B54\u6848\u3002",
    cases: "\u90FD\u8BF4\u771F\u4EBA\u53E3\u64AD\u5BB9\u6613\u53D8\u73B0\uFF0C\u5374\u6CA1\u4EBA\u544A\u8BC9\u4F60\u600E\u4E48\u62CD\uFF1B\u7167\u7247\u6A21\u7CCA\u662F\u56E0\u4E3A\u6CA1\u638C\u63E1\u9510\u5316\u3002",
    combo: "\u635F\u5931\u538C\u6076+\u75DB\u70B9/\u5185\u5E55/\u907F\u5751",
    risk: "\u634F\u9020\u635F\u5931\u3001\u5938\u5927\u201C\u53EA\u6709\u6211\u77E5\u9053\u201D\u3001\u4ED8\u8D39\u524D\u6545\u610F\u4E0D\u7ED9\u57FA\u672C\u7B54\u6848\u3002"
  },
  {
    no: 8,
    name: "\u5BF9\u6BD4\xB7\u5BF9\u7ACB\xB7\u533A\u522B",
    category: "\u51B2\u7A81\u4E0E\u9009\u62E9",
    psychology: "\u5229\u7528\u5DEE\u5F02\u3001\u4E8C\u9009\u4E00\u548C\u7ACB\u573A\u51B2\u7A81\u5438\u5F15\u6BD4\u8F83",
    formula: "A\u548CB\u600E\u4E48\u9009/\u6709\u4EC0\u4E48\u533A\u522B/\u8C01\u66F4X",
    howto: "\u6BD4\u8F83\u5FC5\u987B\u5171\u4EAB\u540C\u4E00\u76EE\u6807\u548C\u8BC4\u4EF7\u7EF4\u5EA6\u3002\u53EF\u7528\u4E8E\u54C1\u724C\u3001\u8EAB\u4EFD\u3001\u5730\u57DF\u3001\u6536\u5165\u3001\u5E73\u53F0\u4E0E\u4EF7\u503C\u89C2\uFF1B\u6B63\u6587\u7ED9\u6807\u51C6\uFF0C\u800C\u975E\u53EA\u6311\u8D77\u9635\u8425\u4E89\u5435\u3002",
    cases: "\u5954\u9A70\u5B9D\u9A6C\u5965\u8FEA\u600E\u4E48\u9009\uFF1B\u4E2D\u5E74\u79BB\u5A5A\u7537\u5973\u8C01\u8FC7\u5F97\u66F4\u597D\uFF1B10\u5143\u70DF\u4E0E100\u5143\u70DF\u533A\u522B\u3002",
    combo: "\u5BF9\u6BD4+\u75DB\u70B9/\u91D1\u94B1/\u4E0D\u540C\u89C6\u89D2",
    risk: "\u4E0D\u516C\u5E73\u6BD4\u8F83\u3001\u4E8C\u5143\u5BF9\u7ACB\u3001\u5730\u57DF\u6027\u522B\u653B\u51FB\u3002"
  },
  {
    no: 9,
    name: "\u5934\u724C\u501F\u52BF",
    category: "\u8BA4\u77E5\u7F3A\u53E3",
    psychology: "\u501F\u540D\u4EBA\u3001\u540D\u4F01\u3001\u6743\u5A01\u673A\u6784\u6216\u70ED\u64AD\u4F5C\u54C1\u7684\u5DF2\u6709\u6CE8\u610F\u529B\u5F15\u51FA\u4E13\u4E1A\u5185\u5BB9",
    formula: "\u5934\u724C\u5BF9\u8C61 + \u76F8\u5173\u95EE\u9898 + \u6211\u7684\u4E13\u4E1A\u89E3\u91CA",
    howto: "\u70ED\u70B9\u5FC5\u987B\u4E0E\u8D5B\u9053\u5B58\u5728\u81EA\u7136\u63A5\u53E3\u3002\u5148\u8BB2\u7528\u6237\u60F3\u770B\u7684\u5934\u724C\uFF0C\u518D\u8D21\u732E\u65B0\u77E5\u8BC6\uFF1B\u7406\u53D1\u3001\u670D\u88C5\u3001\u88C5\u4FEE\u7B49\u90FD\u53EF\u4ECE\u540C\u4E00\u5F71\u89C6\u89D2\u8272\u5207\u5165\u4E0D\u540C\u4E13\u4E1A\u89C6\u89D2\u3002",
    cases: "\u7F8E\u56FD\u6D77\u519B\u5982\u4F55\u4E24\u5206\u949F\u5165\u7761\uFF1B\u62C6\u300A\u72C2\u98D9\u300B\u5927\u5AC2\u7684\u53D1\u578B\u3001\u5986\u5BB9\u3001\u7A7F\u642D\u6216\u4F4F\u5B85\u3002",
    combo: "\u501F\u52BF+\u76F4\u63A5\u63D0\u95EE/\u5185\u5E55/\u4E0D\u540C\u89C6\u89D2",
    risk: "\u751F\u786C\u8E6D\u70ED\u70B9\u3001\u672A\u7ECF\u6838\u5B9E\u5F15\u7528\u3001\u8096\u50CF\u5F71\u89C6\u7248\u6743\u548C\u540D\u8A89\u98CE\u9669\u3002"
  },
  {
    no: 10,
    name: "\u8B66\u544A\u907F\u5751",
    category: "\u4EF7\u503C\u4E0E\u635F\u5931",
    psychology: "\u7528\u6F5C\u5728\u9519\u8BEF\u53CA\u540E\u679C\u89E6\u53D1\u907F\u5BB3\u5FC3\u7406",
    formula: "\u5343\u4E07\u522B\u505AX/\u5FC5\u8E29N\u5751 + \u540E\u679C + \u89C4\u907F\u627F\u8BFA",
    howto: "\u548C\u7126\u8651\u578B\u7684\u533A\u522B\uFF1A\u907F\u5751\u5E94\u6307\u5411\u5177\u4F53\u53EF\u8BC6\u522B\u98CE\u9669\uFF0C\u5E76\u7ED9\u66FF\u4EE3\u65B9\u6848\uFF1B\u7126\u8651\u578B\u5F3A\u8C03\u7D27\u8FEB\u5371\u673A\u3002\u5199\u5B8C\u8981\u4ECE\u7528\u6237\u89D2\u5EA6\u68C0\u67E5\uFF1A\u4ED6\u671F\u5F85\u77E5\u9053\u54EA\u51E0\u4E2A\u5751\u3001\u600E\u6837\u907F\u514D\u3002",
    cases: "\u65B0\u624B\u505A\u6296\u97F3\u5FC5\u8E29\u4E03\u5751\uFF1B\u7626\u8138\u9488\u53EF\u80FD\u51FA\u73B0\u54EA\u4E9B\u9002\u5E94\u8BC1\u4E0E\u98CE\u9669\uFF1B\u521D\u521B\u516C\u53F8\u4E03\u7C7B\u5E38\u89C1\u5931\u8BEF\u3002",
    combo: "\u907F\u5751+\u5708\u4EBA/\u635F\u5931\u538C\u6076/\u76D8\u70B9",
    risk: "\u7EDD\u5BF9\u5316\u533B\u5B66\u7ED3\u8BBA\u3001\u53EA\u5413\u4E0D\u6559\u3001\u501F\u907F\u5751\u8BCB\u6BC1\u7ADE\u54C1\u3002"
  },
  {
    no: 11,
    name: "\u7126\u8651/\u5371\u673A",
    category: "\u4EF7\u503C\u4E0E\u635F\u5931",
    psychology: "\u653E\u5927\u65F6\u95F4\u538B\u529B\u6216\u4E25\u91CD\u540E\u679C\uFF0C\u5236\u9020\u5FC5\u987B\u9A6C\u4E0A\u4E86\u89E3\u7684\u7D27\u8FEB\u611F",
    formula: "\u518D\u4E0DA\u5C31B\uFF1B\u8F6C\u9519C\u5C31\u662FD\uFF1B\u54EA\u7C7B\u4EBA\u6C38\u8FDCE",
    howto: "\u53EA\u6709\u98CE\u9669\u771F\u5B9E\u3001\u7D27\u8FEB\u4E14\u6B63\u6587\u80FD\u7ED9\u53EF\u884C\u51FA\u53E3\u65F6\u624D\u7528\u3002\u7CBE\u51C6\u5782\u7C7B\u5F00\u7BC7\u53EF\u80FD\u89E6\u8FBE\u8F83\u7A84\uFF0C\u4F46\u4E0D\u80FD\u9ED8\u8BA4\u9760\u6295\u6D41\u63A9\u76D6\u5185\u5BB9\u4E0E\u7528\u6237\u4E0D\u5339\u914D\u3002",
    cases: "\u7F8E\u4E1A\u8001\u677F\u518D\u4E0D\u8F6C\u578B\u4F1A\u9762\u4E34\u4EC0\u4E48\uFF1B\u4EC0\u4E48\u6837\u7684\u4EBA\u957F\u671F\u96BE\u4EE5\u79EF\u7D2F\u8D22\u5BCC\uFF1F",
    combo: "\u7126\u8651+\u5708\u4EBA/\u672A\u6765\u8D8B\u52BF/\u8B66\u544A\u907F\u5751",
    risk: "\u6050\u5413\u3001\u8D29\u5356\u7126\u8651\u3001\u865A\u5047\u5012\u8BA1\u65F6\u3001\u628A\u6295\u6D41\u5F53\u5185\u5BB9\u95EE\u9898\u7684\u4E07\u80FD\u8865\u4E01\u3002"
  },
  {
    no: 12,
    name: "\u5185\u5E55\u63ED\u79D8",
    category: "\u8BA4\u77E5\u7F3A\u53E3",
    psychology: "\u5229\u7528\u7AA5\u63A2\u6B32\u89E3\u91CA\u5E55\u540E\u673A\u5236\u3001\u884C\u4E1A\u8BDD\u672F\u4E0E\u9690\u85CF\u5957\u8DEF",
    formula: "\u63ED\u79D8X\u5185\u5E55/\u5185\u884C\u4E0D\u8BF4\u7684\u771F\u76F8 + \u5177\u4F53\u673A\u5236",
    howto: "\u771F\u8BDA\u81EA\u7136\u53EA\u662F\u8868\u8FBE\u5C42\uFF0C\u8BC1\u636E\u771F\u5B9E\u624D\u662F\u5E95\u7EBF\u3002\u53EF\u8BB2\u884C\u4E1A\u6D41\u7A0B\u3001\u5229\u76CA\u94FE\u3001\u9ED1\u8BDD\u3001\u9690\u85CF\u89C4\u5219\uFF1B\u533A\u5206\u4E8B\u5B9E\u3001\u5224\u65AD\u548C\u4E2A\u6848\u3002",
    cases: "\u5356\u8336\u4EBA\u5F88\u5C11\u4E3B\u52A8\u544A\u8BC9\u4F60\u7684\u51E0\u4E2A\u4E8B\u5B9E\uFF1B\u67D0\u7C7B\u66B4\u5229\u751F\u610F\u600E\u6837\u8FD0\u8F6C\uFF1B\u5065\u8EAB\u884C\u4E1A\u5E38\u89C1\u4E71\u8C61\u3002",
    combo: "\u5185\u5E55+\u5934\u724C\u501F\u52BF/\u91D1\u94B1/\u907F\u5751",
    risk: "\u9020\u8C23\u3001\u8BFD\u8C24\u3001\u65E0\u8BC1\u636E\u7206\u6599\u3001\u628A\u6B63\u5E38\u5229\u6DA6\u63CF\u8FF0\u6210\u9A97\u5C40\u3002"
  },
  {
    no: 13,
    name: "\u901F\u6210",
    category: "\u4EF7\u503C\u4E0E\u635F\u5931",
    psychology: "\u7528\u6781\u77ED\u65F6\u95F4\u6216\u6781\u5C11\u6B65\u9AA4\u627F\u8BFA\u4E00\u4E2A\u660E\u786E\u5C0F\u7ED3\u679C\uFF0C\u964D\u4F4E\u5FC3\u7406\u6210\u672C",
    formula: "N\u79D2/\u5206\u949F + \u5B66\u4F1A/\u641E\u5B9A + \u5177\u4F53\u5FAE\u4EFB\u52A1",
    howto: "\u628A\u590D\u6742\u76EE\u6807\u5207\u6210\u53EF\u5151\u73B0\u7684\u5FAE\u6280\u80FD\u3002\u8BFE\u7A0B\u4E2D\u7684\u201C\u4E00\u79D2\u770B\u900F\u4EBA\u201D\u201C\u4E09\u5206\u949F\u53D8\u9AD8\u624B\u201D\u662F\u5438\u775B\u6848\u4F8B\uFF0C\u4E13\u4E1A\u6210\u7A3F\u5E94\u907F\u514D\u65E0\u6CD5\u5151\u73B0\u7684\u5938\u5F20\u3002",
    cases: "3\u79D2\u6539\u5584\u4E00\u4E2A\u52A8\u4F5C\uFF1B8\u5206\u949F\u68B3\u7406\u4E00\u6761\u5386\u53F2\u4E3B\u7EBF\uFF1B3\u5206\u949F\u5B66\u4F1A\u57FA\u7840\u773C\u5F71\u6B65\u9AA4\u3002",
    combo: "\u901F\u6210+\u75DB\u70B9/\u76D8\u70B9/\u9AD8\u4EF7\u503C",
    risk: "\u660E\u77E5\u65E0\u6CD5\u5151\u73B0\u4ECD\u8BF1\u5BFC\u89C2\u770B\u3001\u9690\u7792\u5173\u952E\u8BAD\u7EC3\u4E0E\u98CE\u9669\u3002"
  },
  {
    no: 14,
    name: "\u5F15\u53D1\u5171\u9E23",
    category: "\u76F8\u5173\u6027",
    psychology: "\u590D\u8FF0\u7FA4\u4F53\u771F\u5B9E\u7ECF\u5386\u3001\u60C5\u7EEA\u6216\u5C0F\u4E60\u60EF\uFF0C\u8BA9\u4EBA\u4EA7\u751F\u201C\u6211\u4E5F\u662F\u201D",
    formula: "\u5171\u540C\u5904\u5883/\u7EC6\u8282 + \u88AB\u7406\u89E3\u7684\u5224\u65AD + \u540E\u7EED\u89E3\u91CA",
    howto: "\u4F18\u5148\u5199\u53EF\u89C2\u5BDF\u7EC6\u8282\uFF0C\u800C\u975E\u7A7A\u6D1E\u4EBA\u751F\u9E21\u6C64\u3002\u5171\u9E23\u53EF\u4EE5\u5B89\u6170\u4EBA\uFF0C\u4F46\u4E0D\u5E94\u523B\u610F\u7ED9\u5931\u8D25\u627E\u501F\u53E3\u6216\u8FCE\u5408\u504F\u89C1\u3002",
    cases: "\u603B\u53BB\u540C\u4E00\u5BB6\u9910\u5385\u76F4\u5230\u5403\u817B\uFF1B\u5355\u66F2\u5FAA\u73AF\u76F4\u5230\u542C\u817B\uFF1B\u770B\u4E0D\u4E0A\u4F60\u7684\u4EBA\u5F88\u96BE\u56E0\u4E00\u6B21\u6539\u53D8\u5C31\u6539\u89C2\u3002",
    combo: "\u5171\u9E23+\u5177\u4F53\u7684\u4E8B/\u5708\u4EBA/\u9AD8\u60C5\u7EEA",
    risk: "\u60C5\u7EEA\u8FCE\u5408\u4EE3\u66FF\u4E8B\u5B9E\u3001\u717D\u52A8\u4EC7\u5BCC\u4EC7\u6027\u522B\u3001\u5BBF\u547D\u5316\u7528\u6237\u5904\u5883\u3002"
  },
  {
    no: 15,
    name: "\u6781\u9650\u6570\u5B57",
    category: "\u4EF7\u503C\u4E0E\u635F\u5931",
    psychology: "\u7528\u7F55\u89C1\u6BD4\u4F8B\u6216\u6570\u91CF\u5236\u9020\u7A00\u7F3A\u8BA4\u77E5",
    formula: "99%\u7684\u4EBA\u4E0D\u77E5\u9053/N\u4E2A\u4E2D\u53EA\u67091\u4E2A + \u5177\u4F53\u4FE1\u606F",
    howto: "\u6570\u5B57\u662F\u8BC1\u636E\uFF0C\u4E0D\u662F\u88C5\u9970\u3002\u82E5\u65E0\u6CD5\u7EDF\u8BA1\uFF0C\u5E94\u6539\u4E3A\u201C\u5F88\u591A\u4EBA\u5BB9\u6613\u5FFD\u7565\u201D\u201C\u6211\u89C2\u5BDF\u5230\u7684\u5E38\u89C1\u95EE\u9898\u201D\u3002\u540E\u6587\u8D28\u91CF\u4ECD\u51B3\u5B9A\u5B8C\u64AD\u3002",
    cases: "99%\u7684\u4EBA\u4E0D\u77E5\u9053\u7684\u4EBA\u4F53\u9690\u85CF\u5F00\u5173\uFF08\u8BFE\u7A0B\u6848\u4F8B\uFF09\uFF1B\u7EDD\u5927\u591A\u6570\u65B0\u624B\u5FFD\u7565\u7684\u9996\u5E27\u95EE\u9898\u3002",
    combo: "\u6781\u9650\u6570\u5B57+\u5185\u5E55/\u53CD\u8BA4\u77E5/\u76D8\u70B9",
    risk: "\u865A\u6784\u7EDF\u8BA1\u3001\u4F2A\u79D1\u5B66\u3001\u7528\u6781\u7AEF\u6BD4\u4F8B\u5305\u88C5\u5E38\u8BC6\u3002"
  },
  {
    no: 16,
    name: "\u4E0D\u540C\u89C6\u89D2",
    category: "\u8BA4\u77E5\u7F3A\u53E3",
    psychology: "\u66F4\u6362\u6536\u5165\u3001\u5E74\u9F84\u3001\u804C\u4E1A\u3001\u56FD\u7C4D\u3001\u6027\u522B\u6216\u9636\u6BB5\u6765\u91CD\u770B\u540C\u4E00\u95EE\u9898",
    formula: "X\u8EAB\u4EFD\u773C\u4E2D\u7684Y\uFF1BA\u9636\u6BB5\u4E0EB\u9636\u6BB5\u600E\u4E48\u770BY",
    howto: "\u89C6\u89D2\u63D0\u4F9B\u65B0\u7684\u8BC4\u4EF7\u6807\u51C6\u4E0E\u4FE1\u606F\uFF0C\u800C\u975E\u6362\u4E2A\u6807\u7B7E\u3002\u53EF\u628A\u540C\u884C\u9009\u9898\u4ECE\u53E6\u4E00\u89D2\u8272\u91CD\u6784\uFF0C\u521B\u610F\u7A7A\u95F4\u5F88\u5927\u3002",
    cases: "\u5FC3\u7406\u5B66\u535A\u58EB\u4E3A\u4EC0\u4E48\u7528\u7EFC\u827A\u6062\u590D\u80FD\u91CF\uFF1B\u5317\u6B27\u4EBA\u5982\u4F55\u8BC4\u4EF7\u4E2D\u56FD\u751F\u6D3B\uFF1B\u4E0D\u540C\u6536\u5165\u8005\u5982\u4F55\u7406\u89E3\u81EA\u7531\u3002",
    combo: "\u4E0D\u540C\u89C6\u89D2+\u5BF9\u6BD4/\u5934\u724C/\u53CD\u8BA4\u77E5",
    risk: "\u5192\u5145\u7FA4\u4F53\u4EE3\u8868\u3001\u6587\u5316\u523B\u677F\u5370\u8C61\u3001\u7528\u6027\u522B\u56FD\u7C4D\u5236\u9020\u5BF9\u7ACB\u3002"
  },
  {
    no: 17,
    name: "\u201C\u6700\u201D\u5B57\u6781\u503C",
    category: "\u4EF7\u503C\u4E0E\u635F\u5931",
    psychology: "\u7528\u6700\u597D\u3001\u6700\u5DEE\u3001\u6700\u8D35\u3001\u6700\u4FBF\u5B9C\u7B49\u6392\u5E8F\u8BCD\u6FC0\u53D1\u730E\u5947\u4E0E\u51B3\u7B56\u6B32",
    formula: "\u5BF9\u8C61/\u573A\u666F + \u6700 + \u6781\u503C\u5C5E\u6027 + \u6807\u51C6",
    howto: "\u5FC5\u987B\u5148\u5B9A\u4E49\u8303\u56F4\u3001\u65F6\u95F4\u4E0E\u8BC4\u5224\u6807\u51C6\u3002\u4E13\u4E1A\u80CC\u4E66\u53EF\u589E\u5F3A\u53EF\u4FE1\u5EA6\uFF0C\u5982\u591A\u5E74\u7ECF\u9A8C\u3001\u8DE8\u56FD\u6BD4\u8F83\uFF0C\u4F46\u90FD\u8981\u53EF\u6838\u9A8C\u3002",
    cases: "LV\u5728\u54EA\u4E70\u66F4\u5212\u7B97\uFF1B\u67D0\u57CE\u5E02\u7269\u4E1A\u4F53\u9A8C\u8F83\u5DEE\u7684\u5C0F\u533A\u76D8\u70B9\uFF1B\u4EC0\u4E48\u65B9\u6CD5\u6700\u5FEB\u7ACB\u4F4F\u4EBA\u8BBE\u3002",
    combo: "\u6700\u5B57+\u91D1\u94B1/\u76D8\u70B9/\u9AD8\u4EF7\u503C",
    risk: "\u65E0\u8303\u56F4\u7684\u201C\u5168\u7F51\u6700\u201D\u3001\u6392\u540D\u65E0\u6570\u636E\u3001\u70B9\u540D\u653B\u51FB\u4E3B\u4F53\u3002"
  },
  {
    no: 18,
    name: "\u672A\u6765\u8D8B\u52BF\u4E0E\u5386\u53F2\u6765\u6E90",
    category: "\u8BA4\u77E5\u7F3A\u53E3",
    psychology: "\u6EE1\u8DB3\u63D0\u524D\u51C6\u5907\u548C\u7406\u89E3\u6F14\u53D8\u7684\u9700\u6C42",
    formula: "\u65F6\u95F4\u8282\u70B9 + \u8D8B\u52BF/\u673A\u4F1A/\u5386\u53F2\u8109\u7EDC + \u4F9D\u636E",
    howto: "\u8D8B\u52BF\u5185\u5BB9\u8981\u7ED9\u9A71\u52A8\u56E0\u7D20\u3001\u4FE1\u53F7\u548C\u4E0D\u786E\u5B9A\u6027\uFF1B\u5386\u53F2\u5185\u5BB9\u7ED9\u5173\u952E\u8282\u70B9\u4E0E\u56E0\u679C\u3002\u8BFE\u7A0B\u4E2D\u76842024\u793A\u4F8B\u5DF2\u8FC7\u65F6\uFF0C\u5E94\u66FF\u6362\u4E3A\u5F53\u524D\u6216\u5E38\u9752\u5206\u6790\u3002",
    cases: "\u4E0B\u4E00\u5E74\u5EA6\u7F8E\u4E1A\u8D8B\u52BF\uFF1B\u65B0\u5A92\u4F5320\u5E74\u53D1\u5C55\u53F2\uFF1B\u67D0\u8D5B\u9053\u672A\u6765\u673A\u4F1A\u4E0E\u98CE\u9669\u3002",
    combo: "\u8D8B\u52BF+\u91D1\u94B1/\u5934\u724C/\u4E0D\u540C\u89C6\u89D2",
    risk: "\u628A\u9884\u6D4B\u8BF4\u6210\u5FC5\u7136\u3001\u7528\u65E7\u5E74\u4EFD\u5192\u5145\u6700\u65B0\u3001\u65E0\u6765\u6E90\u653F\u7B56\u89E3\u8BFB\u3002"
  },
  {
    no: 19,
    name: "\u5BF9\u8D4C\u5BF9\u6297",
    category: "\u4E8B\u4EF6\u671F\u5F85",
    psychology: "\u8BBE\u7F6E\u8F93\u8D62\u3001\u6761\u4EF6\u4E0E\u4EE3\u4EF7\uFF0C\u8BA9\u89C2\u4F17\u7B49\u5F85\u8FC7\u7A0B\u548C\u7ED3\u679C",
    formula: "\u82E5\u8FBE\u4E0D\u5230X\u5C31\u4ED8\u51FAY \u2192 \u6267\u884C \u2192 \u7ED3\u679C",
    howto: "\u89C4\u5219\u3001\u53C2\u4E0E\u8005\u3001\u76EE\u6807\u548C\u4EE3\u4EF7\u8981\u6E05\u695A\u3002\u5373\u4F7F\u7ED3\u679C\u540E\u7F6E\uFF0C\u8FC7\u7A0B\u4E5F\u8981\u4EA4\u4ED8\u77E5\u8BC6\u4E0E\u83B7\u5F97\u611F\uFF0C\u4E0D\u80FD\u53EA\u9760\u8D4C\u6CE8\u3002",
    cases: "\u5E2E\u70E7\u70E4\u5E97\u505A\u523010\u4E07\u64AD\u653E\uFF0C\u5426\u5219\u5305\u5706\u4E00\u7BB1\u8089\uFF1B\u53CC\u65B9\u6311\u6218\u5728\u9650\u5B9A\u6761\u4EF6\u4E0B\u5B8C\u6210\u4EFB\u52A1\u3002",
    combo: "\u5BF9\u8D4C+\u91D1\u94B1/\u75DB\u70B9/\u9AD8\u4EF7\u503C",
    risk: "\u5371\u9669\u8D4C\u6CE8\u3001\u5047\u51B2\u7A81\u3001\u672A\u63ED\u6653\u7ED3\u679C\u4E14\u65E0\u5185\u5BB9\u4EF7\u503C\u3002"
  },
  {
    no: 20,
    name: "\u91D1\u94B1\u76F8\u5173",
    category: "\u4EF7\u503C\u4E0E\u635F\u5931",
    psychology: "\u5229\u7528\u4EBA\u4EEC\u5BF9\u6536\u5165\u3001\u6210\u672C\u3001\u4EF7\u683C\u3001\u4E8F\u635F\u548C\u8282\u7701\u7684\u521A\u9700\u5173\u6CE8",
    formula: "\u505AX\u6323/\u82B1/\u4E8F/\u7701\u591A\u5C11\u94B1 + \u6761\u4EF6\u4E0E\u62C6\u8D26",
    howto: "\u6700\u53D7\u5173\u6CE8\u901A\u5E38\u662F\u6323\u94B1\u3001\u7701\u94B1\uFF0C\u5176\u6B21\u4E3A\u6210\u672C\u4E0E\u82B1\u8D39\u3002\u5FC5\u987B\u8BB2\u53E3\u5F84\u3001\u5468\u671F\u3001\u6837\u672C\u548C\u9690\u6027\u6210\u672C\uFF0C\u5E76\u63D0\u9192\u5E78\u5B58\u8005\u504F\u5DEE\u3002",
    cases: "\u5357\u6781\u65C5\u884C\u603B\u82B1\u8D39\uFF1B\u5851\u5F62\u9986\u6708\u5165\u4E0E\u6210\u672C\uFF1B\u5934\u90E8\u5973\u88C5\u8FBE\u4EBA\u6536\u5165\u5982\u4F55\u6784\u6210\u3002",
    combo: "\u91D1\u94B1+\u6781\u9650\u6570\u5B57/\u5185\u5E55/\u5BF9\u6BD4",
    risk: "\u6652\u6536\u5165\u65E0\u8BC1\u636E\u3001\u53EA\u8BB2\u8425\u6536\u4E0D\u8BB2\u6210\u672C\u3001\u6697\u793A\u53EF\u590D\u5236\u66B4\u5BCC\u3002"
  },
  {
    no: 21,
    name: "\u76D8\u70B9\u4E0E\u63A8\u8350",
    category: "\u4EF7\u503C\u4E0E\u635F\u5931",
    psychology: "\u4E00\u6B21\u6027\u7B5B\u9009\u591A\u9879\u8D44\u6E90\uFF0C\u63D0\u4F9B\u7701\u65F6\u548C\u6536\u85CF\u4EF7\u503C",
    formula: "\u76EE\u6807\u4EBA\u7FA4 + N\u4E2A\u5BF9\u8C61 + \u7EDF\u4E00\u6807\u51C6 + \u63A8\u8350\u7406\u7531",
    howto: "\u53EF\u63A8\u8350\u7F51\u7AD9\u3001\u5DE5\u5177\u3001\u4E66\u5355\u3001\u6280\u5DE7\u3001\u526F\u4E1A\u7B49\u3002\u4FE1\u606F\u591A\u4E0D\u7B49\u4E8E\u6709\u4EF7\u503C\uFF0C\u8981\u8BF4\u660E\u7B5B\u9009\u6807\u51C6\u3001\u9002\u7528\u4E0E\u4E0D\u9002\u7528\uFF1B\u65B0\u53F7\u53EF\u7528\u7CFB\u5217\u9A8C\u8BC1\u9700\u6C42\u3002",
    cases: "\u65B0\u5A92\u4F53\u4EBA\u5E38\u7528\u7F51\u7AD9\uFF1B\u63D0\u5347\u6548\u7387\u7684\u5DE5\u5177\uFF1B\u67D0\u9886\u57DF\u5165\u95E8\u4E66\u5355\u3002",
    combo: "\u76D8\u70B9+\u5708\u4EBA/\u9AD8\u4EF7\u503C/\u6700\u5B57",
    risk: "\u5806\u540D\u5355\u3001\u672A\u4F7F\u7528\u5C31\u63A8\u8350\u3001\u5229\u76CA\u5173\u7CFB\u4E0D\u62AB\u9732\u3001\u6279\u91CF\u4F4E\u8D28\u3002"
  },
  {
    no: 22,
    name: "\u8DE8\u754C\u7EC4\u5408",
    category: "\u8BA4\u77E5\u7F3A\u53E3",
    psychology: "\u628A\u4E24\u4E2A\u4E0D\u540C\u8D5B\u9053\u5173\u952E\u8BCD\u8FDE\u63A5\uFF0C\u5F62\u6210\u65B0\u8054\u60F3\u5E76\u5438\u5F15\u4E24\u7C7B\u4EBA\u7FA4",
    formula: "\u8D5B\u9053A \xD7 \u8D5B\u9053B \u2192 \u65B0\u95EE\u9898/\u89E3\u91CA",
    howto: "\u7EC4\u5408\u5E94\u4EA7\u751F\u65B0\u6D1E\u5BDF\uFF0C\u4E0D\u662F\u4E24\u4E2A\u70ED\u70B9\u786C\u8D34\u3002\u6C7D\u8F66\xD7\u6027\u683C\u3001\u7A7F\u642D\xD7\u804C\u4E1A\u3001\u8BF4\u8BDD\u65B9\u5F0F\xD7\u6027\u683C\uFF0C\u90FD\u8981\u6C42\u89E3\u91CA\u4E24\u8005\u4E3A\u4F55\u76F8\u5173\u3002",
    cases: "\u5F00\u4EC0\u4E48\u8F66\u80FD\u5426\u53CD\u6620\u804C\u4E1A\u4E60\u60EF\uFF1B\u670D\u88C5\u5982\u4F55\u5F71\u54CD\u4ED6\u4EBA\u5BF9\u804C\u4E1A\u89D2\u8272\u7684\u5224\u65AD\u3002",
    combo: "\u8DE8\u754C+\u4E0D\u540C\u89C6\u89D2/\u5BF9\u6BD4/\u76F4\u63A5\u63D0\u95EE",
    risk: "\u4F2A\u5FC3\u7406\u5B66\u3001\u523B\u677F\u753B\u50CF\u3001\u76F8\u5173\u6027\u88AB\u8BF4\u6210\u56E0\u679C\u3002"
  },
  {
    no: 23,
    name: "\u9001\u60CA\u559C",
    category: "\u4E8B\u4EF6\u671F\u5F85",
    psychology: "\u79D8\u5BC6\u51C6\u5907\u793C\u7269\u6216\u4F53\u9A8C\uFF0C\u8BA9\u89C2\u4F17\u7B49\u5F85\u63A5\u6536\u8005\u53CD\u5E94",
    formula: "\u7792\u7740/\u5077\u5077\u4E3AX\u51C6\u5907Y \u2192 \u63ED\u6653 \u2192 \u771F\u5B9E\u53CD\u5E94",
    howto: "\u771F\u6B63\u7684\u60C5\u7EEA\u4EF7\u503C\u901A\u5E38\u6765\u81EA\u4EBA\u7269\u53CD\u5E94\u800C\u975E\u793C\u7269\u4EF7\u683C\u3002\u51C6\u5907\u8FC7\u7A0B\u8981\u4EA4\u4EE3\u5173\u7CFB\u4E0E\u52A8\u673A\uFF0C\u955C\u5934\u4F18\u5148\u6355\u6349\u81EA\u7136\u53CD\u5E94\u3002",
    cases: "\u6084\u6084\u7ED9\u5988\u5988\u51C6\u5907\u793C\u7269\uFF1B\u7792\u7740\u59BB\u5B50\u4E70\u4E0B\u706B\u9505\u5E97\u8BA9\u5979\u5F53\u8001\u677F\u5A18\u3002",
    combo: "\u9001\u60CA\u559C+\u4EBA\u7269\u5173\u7CFB/\u91D1\u94B1/\u6545\u4E8B\u611F",
    risk: "\u9AD8\u6210\u672C\u6500\u6BD4\u3001\u6446\u62CD\u53CD\u5E94\u3001\u672A\u7ECF\u540C\u610F\u516C\u5F00\u9690\u79C1\u3002"
  },
  {
    no: 24,
    name: "\u8377\u5C14\u8499/\u4EBA\u7269\u5438\u5F15",
    category: "\u89C6\u89C9\u4E0E\u611F\u5B98",
    psychology: "\u5229\u7528\u5916\u8C8C\u3001\u6C14\u8D28\u3001\u8EAB\u6750\u6216\u4EBA\u7269\u9B45\u529B\u5F62\u6210\u89C6\u89C9\u6CE8\u610F",
    formula: "\u9B45\u529B\u4EBA\u7269\u9996\u5E27 + \u9002\u5EA6\u60AC\u5FF5 + \u5185\u5BB9\u4EF7\u503C",
    howto: "\u9B45\u529B\u53EF\u4EE5\u662F\u989C\u503C\u3001\u6C14\u8D28\u3001\u80FD\u529B\u6216\u89D2\u8272\uFF0C\u4E0D\u5E94\u53EA\u7269\u5316\u8EAB\u4F53\u3002\u60AC\u5FF5\u8981\u5408\u7406\u5EF6\u8FDF\uFF0C\u4E0D\u80FD\u523B\u610F\u906E\u8138\u5230\u635F\u5BB3\u4F53\u9A8C\u3002",
    cases: "\u957F\u5F97\u50CF\u660E\u661F\u7684\u76F8\u4EB2\u5BF9\u8C61\uFF1B\u6709\u9B45\u529B\u7684\u4E0A\u95E8\u79C1\u53A8\u53CA\u670D\u52A1\u8FC7\u7A0B\u3002",
    combo: "\u4EBA\u7269\u5438\u5F15+\u63D0\u95EE/\u9001\u60CA\u559C/\u6545\u4E8B\u611F",
    risk: "\u5077\u62CD\u3001\u6027\u6697\u793A\u64E6\u8FB9\u3001\u7269\u5316\u3001\u7528\u5BB9\u8C8C\u8BF1\u5BFC\u5374\u65E0\u5B9E\u8D28\u5185\u5BB9\u3002"
  },
  {
    no: 25,
    name: "\u76F2\u76D2",
    category: "\u4E8B\u4EF6\u671F\u5F85",
    psychology: "\u628A\u968F\u673A\u6027\u53D8\u6210\u5F00\u7BC7\u89C4\u5219\uFF0C\u8BA9\u4EBA\u7B49\u5F85\u62BD\u53D6\u4E0E\u6267\u884C\u7ED3\u679C",
    formula: "\u9884\u7B97/\u8303\u56F4 + \u968F\u673A\u673A\u5236 + \u62BD\u5230\u4EC0\u4E48\u505A\u4EC0\u4E48",
    howto: "\u5148\u9650\u5B9A\u5B89\u5168\u3001\u9884\u7B97\u548C\u53EF\u6267\u884C\u8303\u56F4\uFF0C\u518D\u516C\u5F00\u968F\u673A\u8FC7\u7A0B\u3002\u53EF\u53E0\u52A0\u6587\u5316\u3001\u4E13\u4E1A\u62C6\u89E3\u6216\u65C5\u884C\uFF0C\u5F62\u6210\u957F\u671F\u680F\u76EE\u3002",
    cases: "200\u5143\u9910\u996E\u76F2\u76D2\uFF1B100\u5143\u5185\u6700\u5FEB\u51FA\u53D1\u8F66\u7968\uFF1B\u5510\u8BD7\u7FFB\u5230\u54EA\u91CC\u5C31\u53BB\u54EA\u91CC\uFF1B\u98DE\u9556\u9009\u54C1\u724C\u505A\u8425\u9500\u62C6\u89E3\u3002",
    combo: "\u76F2\u76D2+\u91D1\u94B1/\u65C5\u884C/\u76D8\u70B9",
    risk: "\u4F2A\u968F\u673A\u3001\u8D85\u9884\u7B97\u3001\u5371\u9669\u76EE\u7684\u5730\u6216\u670D\u52A1\u3001\u8D4C\u535A\u5316\u8BBE\u8BA1\u3002"
  },
  {
    no: 26,
    name: "\u5947\u8469\u730E\u5947",
    category: "\u4E8B\u4EF6\u671F\u5F85",
    psychology: "\u5C55\u793A\u5F02\u5E38\u3001\u5C11\u89C1\u3001\u8FDD\u80CC\u65E5\u5E38\u7ECF\u9A8C\u7684\u4EBA\u4E8B\u7269",
    formula: "\u884C\u4E1A/\u5730\u533A + \u5947\u8469\u5BF9\u8C61 + \u5230\u5E95\u591A\u5947\u8469",
    howto: "\u201C\u5947\u8469\u201D\u5E94\u6307\u5411\u73B0\u8C61\u7684\u65B0\u5947\u7A0B\u5EA6\uFF0C\u6B63\u6587\u89E3\u91CA\u4E3A\u4EC0\u4E48\u5F62\u6210\u3001\u4F53\u9A8C\u5982\u4F55\u3002\u53EF\u505A\u7F8E\u98DF\u3001\u5C97\u4F4D\u3001\u4F01\u4E1A\u3001\u8D26\u53F7\u7B49\u7CFB\u5217\u3002",
    cases: "\u4E2D\u56FD\u5947\u8469\u7F8E\u98DF\uFF1B\u804C\u573A\u5947\u8469\u5C97\u4F4D\uFF1B\u8D5B\u9053\u5185\u5947\u8469\u8D26\u53F7\u76D8\u70B9\u3002",
    combo: "\u5947\u8469+\u6700\u5B57/\u76F2\u76D2/\u5BF9\u6BD4",
    risk: "\u7F9E\u8FB1\u4E2A\u4EBA\u3001\u730E\u5947\u5371\u9669\u884C\u4E3A\u3001\u628A\u6587\u5316\u5DEE\u5F02\u5F53\u7B11\u8BDD\u3002"
  },
  {
    no: 27,
    name: "\u8D1F\u9762\u4E8B\u4EF6\u5207\u5165",
    category: "\u4EF7\u503C\u4E0E\u635F\u5931",
    psychology: "\u5229\u7528\u4EBA\u5BF9\u9519\u8BEF\u3001\u6B3A\u9A97\u3001\u5931\u8D25\u548C\u4E89\u8BAE\u7684\u6CE8\u610F\u504F\u597D\u8FDB\u5165\u6545\u4E8B",
    formula: "\u8D1F\u9762\u52A8\u4F5C/\u8BEF\u89E3 \u2192 \u539F\u56E0\u4E0E\u8FC7\u7A0B \u2192 \u53CD\u8F6C/\u4EF7\u503C",
    howto: "\u8BFE\u7A0B\u4EE5\u201C\u5728\u706B\u9505\u5E97\u5077\u5403\u201D\u5F0F\u8868\u8FF0\u8FDB\u5165\u6E29\u60C5\u6545\u4E8B\u3002\u8D1F\u9762\u8BCD\u662F\u5165\u53E3\uFF0C\u6B63\u6587\u8981\u89E3\u91CA\u771F\u5B9E\u8BED\u5883\u5E76\u5B8C\u6210\u4EF7\u503C\u56DE\u6536\u3002",
    cases: "\u4E0B\u73ED\u9519\u8FC7\u996D\u70B9\uFF0C\u56E0\u5E2E\u6E05\u6D01\u5DE5\u626B\u5730\u800C\u88AB\u9080\u8BF7\u8FDB\u5E97\u5403\u996D\uFF0C\u968F\u540E\u8EAB\u4EFD\u53CD\u8F6C\u3002",
    combo: "\u8D1F\u9762+\u6545\u4E8B\u611F/\u5185\u5E55/\u53CD\u5DEE",
    risk: "\u6807\u9898\u8BEC\u9677\u5F53\u4E8B\u4EBA\u3001\u6A21\u4EFF\u8FDD\u6CD5\u884C\u4E3A\u3001\u53EA\u9760\u8D1F\u9762\u523A\u6FC0\u3002"
  },
  {
    no: 28,
    name: "\u76F4\u63A5\u8BF4\u5177\u4F53\u7684\u4E8B",
    category: "\u4E8B\u4EF6\u671F\u5F85",
    psychology: "\u50CF\u670B\u53CB\u4E00\u6837\u76F4\u63A5\u5206\u4EAB\u6B63\u5728\u53D1\u751F\u7684\u751F\u6D3B\u7EC6\u8282\uFF0C\u8BA9\u89C2\u4F17\u53C2\u4E0E\u964C\u751F\u4EBA\u7684\u751F\u6D3B",
    formula: "\u65F6\u95F4/\u5730\u70B9/\u52A8\u4F5C + \u4E00\u4E2A\u5177\u4F53\u53D1\u73B0 + \u611F\u53D7/\u8054\u60F3",
    howto: "\u771F\u8BDA\u6765\u81EA\u53EF\u89C2\u5BDF\u7EC6\u8282\uFF1A\u5403\u4E86\u4EC0\u4E48\u3001\u9047\u5230\u8C01\u3001\u5F53\u65F6\u60F3\u5230\u4EC0\u4E48\u3002\u5177\u4F53\u751F\u6D3B\u53EF\u4EE5\u81EA\u7136\u8F6C\u5165\u89C2\u70B9\u6216\u4E13\u4E1A\u89C2\u5BDF\u3002",
    cases: "\u4ECA\u5929\u8D77\u65E9\u4E70\u8C46\u6C41\u65E9\u9910\uFF1B\u5403\u5B8C\u70E7\u997C\u7A81\u7136\u60F3\u5230\u4E0D\u540C\u9636\u5C42\u7684\u8868\u8C61\uFF1B\u5403\u996D\u65F6\u53D1\u73B0\u9910\u5385\u90FD\u5728\u505A\u6781\u7B80\u98CE\u3002",
    combo: "\u5177\u4F53\u7684\u4E8B+\u5171\u9E23/\u6545\u4E8B\u611F/\u4E13\u4E1A\u89C2\u5BDF",
    risk: "\u6D41\u6C34\u8D26\u3001\u5047\u88C5\u968F\u624B\u5374\u786C\u690D\u5E7F\u544A\u3001\u6CC4\u9732\u4ED6\u4EBA\u9690\u79C1\u3002"
  },
  {
    no: 29,
    name: "\u9AD8\u60C5\u7EEA",
    category: "\u89C6\u89C9\u4E0E\u611F\u5B98",
    psychology: "\u7528\u5F3A\u70C8\u3001\u53EF\u89C1\u53EF\u542C\u7684\u60C5\u7EEA\u72B6\u6001\u76F4\u63A5\u6293\u4F4F\u6CE8\u610F",
    formula: "\u9C9C\u660E\u6001\u5EA6 + \u8868\u60C5/\u58F0\u97F3/\u52A8\u4F5C + \u5185\u5BB9\u51FA\u53E3",
    howto: "\u9AD8\u60C5\u7EEA\u4E0D\u7B49\u4E8E\u558A\u53EB\u3002\u8981\u4E0EIP\u6027\u683C\u5339\u914D\uFF0C\u7528\u91CD\u97F3\u3001\u505C\u987F\u3001\u8868\u60C5\u3001\u80A2\u4F53\u548C\u955C\u5934\u5171\u540C\u5B8C\u6210\u3002\u5148\u505A\u81EA\u6211\u8BA4\u77E5\uFF0C\u9009\u62E9\u80FD\u957F\u671F\u7EF4\u6301\u7684\u72B6\u6001\u3002",
    cases: "\u66B4\u8E81\u4F46\u52A1\u5B9E\u7684\u7559\u5B66\u5EFA\u8BAE\uFF1B\u7F8E\u672F\u8054\u8003\u5410\u69FD\uFF1B\u5065\u8EAB\u72B6\u6001\u5C55\u793A\u3002",
    combo: "\u9AD8\u60C5\u7EEA+\u75DB\u70B9/\u5171\u9E23/\u53CD\u8BA4\u77E5",
    risk: "\u8FB1\u9A82\u3001\u6301\u7EED\u8FC7\u8F7D\u3001\u6A21\u4EFF\u4E0D\u9002\u5408\u81EA\u5DF1\u7684\u4EBA\u683C\u3001\u60C5\u7EEA\u63A9\u76D6\u4E8B\u5B9E\u3002"
  },
  {
    no: 30,
    name: "\u5F3A\u8282\u594F",
    category: "\u89C6\u89C9\u4E0E\u611F\u5B98",
    psychology: "\u7528\u753B\u9762\u3001\u52A8\u4F5C\u3001\u58F0\u97F3\u4E0E\u4FE1\u606F\u5207\u6362\u5F62\u6210\u63A8\u8FDB\u611F",
    formula: "\u5F3A\u52A8\u4F5C\u9996\u5E27 \u2192 \u8282\u62CD\u526A\u8F91 \u2192 \u8FDE\u7EED\u4FE1\u606F\u70B9 \u2192 \u547C\u5438\u70B9",
    howto: "\u8282\u594F\u662F\u4FE1\u606F\u53D8\u5316\u7387\uFF0C\u4E0D\u7B49\u4E8E\u6BCF\u79D2\u5207\u955C\u3002\u955C\u5934\u8FD0\u52A8\u3001\u5B57\u5E55\u3001\u97F3\u6548\u3001\u52A8\u4F5C\u548C\u8BED\u901F\u9700\u540C\u62CD\uFF1B\u590D\u6742\u5185\u5BB9\u8981\u7559\u7406\u89E3\u65F6\u95F4\u3002",
    cases: "\u5FEB\u9012\u5F00\u7BB1/\u5962\u4F88\u54C1\u4FEE\u590D\u7B49\u4EE5\u8FDE\u7EED\u52A8\u4F5C\u4E0E\u955C\u5934\u5207\u6362\u5F00\u573A\u3002",
    combo: "\u5F3A\u8282\u594F+\u9AD8\u60C5\u7EEA/\u6C89\u6D78/\u53CD\u5DEE",
    risk: "\u4E71\u5207\u3001\u97F3\u4E50\u538B\u4EBA\u58F0\u3001\u6CA1\u6709\u53D9\u4E8B\u91CD\u70B9\u3001\u5F15\u53D1\u7729\u6655\u3002"
  },
  {
    no: 31,
    name: "\u51D1\u70ED\u95F9",
    category: "\u89C6\u89C9\u4E0E\u611F\u5B98",
    psychology: "\u7528\u4EBA\u7FA4\u3001\u6392\u961F\u3001\u56F4\u89C2\u6216\u591A\u4EBA\u540C\u6846\u89E6\u53D1\u793E\u4F1A\u8BC1\u660E\u4E0E\u7F8A\u7FA4\u6CE8\u610F",
    formula: "\u70ED\u95F9\u9996\u5E27 + \u4E3A\u4EC0\u4E48\u805A\u96C6 + \u6838\u5FC3\u4E8B\u4EF6",
    howto: "\u4EBA\u591A\u53EA\u662F\u6CE8\u610F\u4FE1\u53F7\uFF0C\u6B63\u6587\u8981\u5FEB\u901F\u89E3\u91CA\u53D1\u751F\u4EC0\u4E48\u3002\u53EF\u4E0E\u53CD\u5DEE\u7ED3\u5408\uFF0C\u5982\u591A\u4EBA\u5171\u540C\u5B8C\u6210\u5F02\u5E38\u884C\u4E3A\u3002",
    cases: "\u535A\u4E3B\u540E\u65B9\u5B89\u6392\u591A\u4EBA\u5F62\u6210\u73B0\u573A\u611F\uFF1B\u591A\u4EBA\u53C2\u4E0E\u53CD\u5DEE\u8D70\u79C0\u3002",
    combo: "\u51D1\u70ED\u95F9+\u53CD\u5DEE/\u5BF9\u8D4C/\u8857\u5934\u4E8B\u4EF6",
    risk: "\u4EBA\u4E3A\u5835\u585E\u516C\u5171\u7A7A\u95F4\u3001\u672A\u7ECF\u540C\u610F\u62CD\u6444\u3001\u5047\u6392\u961F\u865A\u5047\u7E41\u8363\u3002"
  },
  {
    no: 32,
    name: "\u6C89\u6D78\u611F",
    category: "\u89C6\u89C9\u4E0E\u611F\u5B98",
    psychology: "\u7528\u8FDE\u7EED\u64CD\u4F5C\u3001\u8D28\u611F\u58F0\u97F3\u548C\u7EC6\u8282\u955C\u5934\u8BA9\u89C2\u4F17\u8FDB\u5165\u8FC7\u7A0B",
    formula: "\u6E05\u6670\u52A8\u4F5C + \u8FD1\u666F\u7EC6\u8282 + \u539F\u58F0/\u8282\u594F + \u5B8C\u6210\u53CD\u9988",
    howto: "\u6309\u6469\u3001SPA\u3001\u5207\u83DC\u3001\u6E05\u6D17\u3001\u4FEE\u8E44\u90FD\u53EF\u6C89\u6D78\u3002\u5173\u952E\u662F\u52A8\u4F5C\u53EF\u9884\u6D4B\u53C8\u6709\u5FAE\u5C0F\u53D8\u5316\uFF0C\u58F0\u753B\u771F\u5B9E\uFF0C\u51CF\u5C11\u65E0\u5173\u89E3\u91CA\u3002",
    cases: "\u6C89\u6D78\u5F0F\u5207\u83DC\uFF1B\u5730\u6BEF\u6E05\u6D17\uFF1B\u4FEE\u9A74\u8E44\uFF1B\u6709\u6B65\u9AA4\u7684\u624B\u4F5C\u8FC7\u7A0B\u3002",
    combo: "\u6C89\u6D78+\u6CBB\u6108/\u5F3A\u8282\u594F/\u6539\u9020",
    risk: "\u5371\u9669\u64CD\u4F5C\u6A21\u4EFF\u3001\u672A\u7ECF\u52A8\u7269\u798F\u5229\u8BC4\u4F30\u3001\u8FC7\u5EA6\u97F3\u6548\u9020\u5047\u3002"
  },
  {
    no: 33,
    name: "\u53CD\u5DEE\u611F",
    category: "\u89C6\u89C9\u4E0E\u611F\u5B98",
    psychology: "\u628A\u8EAB\u4EFD\u3001\u73AF\u5883\u3001\u80FD\u529B\u3001\u884C\u4E3A\u6216\u4EF7\u683C\u653E\u5728\u4E0D\u7B26\u5408\u9884\u671F\u7684\u7EC4\u5408\u4E2D",
    formula: "\u9884\u671FA + \u753B\u9762B \u2192 \u53CD\u5DEE \u2192 \u80FD\u529B/\u6545\u4E8B\u89E3\u91CA",
    howto: "\u53CD\u5DEE\u901A\u5E38\u4E3B\u8981\u9760\u753B\u9762\u5148\u88AB\u611F\u77E5\u3002\u6280\u80FD\u8D8A\u5F3A\u3001\u73AF\u5883\u8D8A\u6734\u7D20\uFF0C\u51B2\u51FB\u8D8A\u5927\uFF1B\u573A\u666F\u4ECD\u8981\u6709\u903B\u8F91\uFF0C\u4E0D\u80FD\u53EA\u6362\u8863\u670D\u3002",
    cases: "\u519C\u6751\u88C5\u626E\u5531\u9AD8\u96BE\u5EA6\u6B4C\u66F2\uFF1B\u8DEF\u8FB9\u70E7\u70E4\u644A\u5F39\u5409\u4ED6\uFF1B\u8F66\u5185\u505A\u996D\uFF1B\u5E84\u56ED\u4E0E\u4EB2\u5207\u53E3\u543B\u5E76\u7F6E\u3002",
    combo: "\u53CD\u5DEE+\u9AD8\u60C5\u7EEA/\u6545\u4E8B\u611F/\u7279\u6B8A\u89C6\u89D2",
    risk: "\u6D88\u8D39\u804C\u4E1A\u6216\u519C\u6751\u8EAB\u4EFD\u3001\u6446\u62CD\u730E\u5947\u3001\u53CD\u5DEE\u4E0E\u5185\u5BB9\u65E0\u5173\u3002"
  },
  {
    no: 34,
    name: "\u7279\u6B8A\u89C6\u89D2\u62CD\u6444",
    category: "\u89C6\u89C9\u4E0E\u611F\u5B98",
    psychology: "\u6539\u53D8\u673A\u4F4D\u3001\u53D9\u4E8B\u4E3B\u4F53\u6216\u89C2\u770B\u4F4D\u7F6E\uFF0C\u63D0\u4F9B\u666E\u901A\u955C\u5934\u770B\u4E0D\u5230\u7684\u4FE1\u606F",
    formula: "\u65B0POV\u9996\u5E27 + \u4E8B\u4EF6\u5C55\u5F00 + \u89C6\u89D2\u5E26\u6765\u7684\u53D1\u73B0",
    howto: "\u53EF\u4EE5\u662F\u7B2C\u4E00\u89C6\u89D2\u3001\u65C1\u89C2/\u5077\u7AA5\u611F\u3001\u76D1\u63A7\u5E7F\u89D2\u3001\u7269\u4F53\u6216\u5BA0\u7269\u89C6\u89D2\u3002\u94A9\u5B50\u5FC5\u987B\u4E0E\u8D26\u53F7\u5B9A\u4F4D\u5339\u914D\uFF0C\u7528\u5F97\u4E0D\u5F53\u4F1A\u7834\u574F\u53EF\u4FE1\u5EA6\u3002",
    cases: "\u4ECE\u4E0D\u540C\u4EBA\u7269\u89C6\u89D2\u8BB0\u5F55\u76F8\u4EB2\u6216\u5BB6\u5EAD\u51B3\u7B56\uFF1B\u5C11\u89C1\u89C6\u89D2\u5448\u73B0\u7F8E\u672F\u751F\u9009\u62E9\u3002",
    combo: "\u7279\u6B8A\u89C6\u89D2+\u6545\u4E8B\u611F/\u53CD\u5DEE/\u6C89\u6D78",
    risk: "\u5077\u62CD\u4E0E\u9690\u79C1\u3001\u4F2A\u88C5\u76D1\u63A7\u3001\u673A\u4F4D\u65B0\u5947\u4F46\u4FE1\u606F\u65E0\u589E\u91CF\u3002"
  },
  {
    no: 35,
    name: "\u6545\u4E8B\u611F/\u60C5\u5883\u5316\u53E3\u64AD",
    category: "\u89C6\u89C9\u4E0E\u611F\u5B98",
    psychology: "\u7528\u753B\u9762\u6587\u5B57\u3001\u4EBA\u7269\u5173\u7CFB\u548C\u573A\u666F\u8BA9\u666E\u901A\u53E3\u64AD\u6216\u52A8\u4F5C\u5E26\u6709\u524D\u56E0\u540E\u679C",
    formula: "\u4E00\u53E5\u6545\u4E8B\u8BBE\u5B9A + \u5173\u7CFB/\u76EE\u6807 + \u753B\u9762\u8BC1\u636E + \u53E3\u64AD\u89C2\u70B9",
    howto: "\u53E3\u64AD\u81F3\u5C11\u8981\u5728\u6587\u6848\u3001\u573A\u666F\u5448\u73B0\u3001\u4E2A\u4EBA\u8868\u73B0\u529B\u4E09\u9879\u4E2D\u6709\u4E00\u9879\u5F3A\uFF1B\u66F4\u597D\u7684\u505A\u6CD5\u662F\u8BA9\u80CC\u666F\u4EBA\u7269\u548C\u73AF\u5883\u53C2\u4E0E\u53D9\u4E8B\u3002",
    cases: "\u753B\u9762\u6587\u5B57\u8BBE\u5B9A\u201C\u53BB\u76F8\u4EB2186\u4F53\u80B2\u751F\u201D\uFF1B\u524D\u666F\u59BB\u5B50\u5410\u69FD\uFF0C\u80CC\u666F\u4E08\u592B\u4E0E\u67DC\u59D0\u4E92\u52A8\u3002",
    combo: "\u6545\u4E8B\u611F+\u4EBA\u7269\u5438\u5F15/\u5177\u4F53\u7684\u4E8B/\u9001\u60CA\u559C",
    risk: "\u865A\u6784\u82E6\u96BE\u9A97\u60C5\u7EEA\u3001\u573A\u666F\u4E0E\u53E3\u64AD\u65E0\u5173\u3001\u80CC\u666F\u62A2\u4FE1\u606F\u3002"
  },
  {
    no: 36,
    name: "\u590D\u53E4\u6000\u65E7",
    category: "\u89C6\u89C9\u4E0E\u611F\u5B98",
    psychology: "\u901A\u8FC7\u5E74\u4EE3\u753B\u9762\u3001\u8001\u6B4C\u3001\u65E7\u7269\u548C\u670D\u5316\u9053\u5524\u8D77\u8BB0\u5FC6\u4E0E\u8EAB\u4EFD\u8BA4\u540C",
    formula: "\u5E74\u4EE3\u951A\u70B9 + \u89C6\u542C\u7B26\u53F7 + \u4E2A\u4EBA\u8BB0\u5FC6/\u4ECA\u6614\u5BF9\u7167",
    howto: "30\u5C81\u4EE5\u4E0A\u4EBA\u7FA4\u5F80\u5F80\u66F4\u6613\u88AB\u6000\u65E7\u89E6\u53D1\uFF0C\u4F46\u4EFB\u4F55\u5E74\u9F84\u90FD\u6709\u81EA\u5DF1\u7684\u9752\u6625\u951A\u70B9\u3002\u58F0\u97F3\u4E0E\u753B\u9762\u5171\u540C\u4F5C\u7528\uFF0C\u7EC6\u8282\u9700\u8981\u8003\u636E\u3002",
    cases: "94\u5E74\u534E\u8BED\u4E50\u575B\u3001\u8001\u5267\u4E3B\u9898\u66F2\u3001\u65E7\u573A\u666F\u4E0E\u670D\u9970\u3002",
    combo: "\u6000\u65E7+\u76D8\u70B9/\u5386\u53F2\u6765\u6E90/\u6C89\u6D78",
    risk: "\u97F3\u4E50\u5F71\u89C6\u7248\u6743\u3001\u5E74\u4EE3\u9519\u7F6E\u3001\u53EA\u52A0\u6EE4\u955C\u6CA1\u6709\u5185\u5BB9\u3002"
  }
];
var OPENING_CATEGORIES = Array.from(
  new Set(OPENING_CARDS.map((c) => c.category))
).filter(Boolean);
var BY_NAME2 = new Map(OPENING_CARDS.map((c) => [c.name, c]));

// .tmp/content-audit-production_20261008/lib/creative-routes.ts
var ROUTES_GUIDE = `### \u4E24\u5957\u6253\u6CD5\uFF1A\u56DB\u5927\u811A\u672C\uFF08\u859B\u8001\u5E08\uFF09\u548C\u8D77\u53F7 36 \u8BA1\uFF08\u5C0F\u9EC4\uFF09

\u4E24\u5957\u90FD\u662F\u597D\u83DC\uFF0C\u4E92\u76F8\u8865\u77ED\u677F\uFF0C\u4E0D\u662F\u4E8C\u9009\u4E00\uFF1A

| | \u56DB\u5927\u811A\u672C + \u516B\u5927\u7206\u6B3E\u5143\u7D20\uFF08\u859B\u8001\u5E08\uFF09 | \u8D77\u53F7 36 \u8BA1\uFF08\u5C0F\u9EC4\uFF09 |
|---|---|---|
| \u4ECE\u54EA\u51FA\u53D1 | **\u8BB2\u4EC0\u4E48**\uFF1A\u5148\u7528\u7206\u6B3E\u5143\u7D20\u627E\u9009\u9898\u89D2\u5EA6\uFF0C\u518D\u7528\u804A\u89C2\u70B9 / \u6652\u8FC7\u7A0B / \u6559\u77E5\u8BC6 / \u8BB2\u6545\u4E8B\u7684\u7ED3\u6784\u8BB2 | **\u600E\u4E48\u62CD**\uFF1A\u6BCF\u4E00\u8BA1\u662F\u4E00\u4E2A\u73B0\u6210\u7684\u62CD\u6CD5\uFF08\u4E8B\u4EF6\u600E\u4E48\u8D70\uFF09\uFF0C\u5957\u4E0A\u8FD9\u4E2A\u884C\u4E1A\u5C31\u80FD\u62CD |
| \u5F3A\u9879 | \u6709\u89C2\u70B9\u3001\u6709\u6545\u4E8B\uFF0C\u7ACB\u5F97\u4F4F\u4EBA\u8BBE\uFF0C\u8BB2\u5F97\u6E05\u6210\u4EA4\u7406\u7531 | \u597D\u843D\u5730\uFF1A\u4E0D\u9760\u53E3\u624D\u3001\u4E0D\u9760\u9009\u9898\u7075\u611F\uFF0C\u7167\u516C\u5F0F\u62CD\uFF1B\u8D77\u53F7\u62FF\u6D41\u91CF\u5FEB |
| \u77ED\u677F | \u592A\u4F9D\u8D56\u7206\u6B3E\u5143\u7D20\u627E\u9009\u9898\uFF1B\u53E3\u64AD\u4E3A\u4E3B\uFF0C\u5BF9\u8868\u8FBE\u8981\u6C42\u9AD8\uFF0C\u4E0D\u5BB9\u6613\u843D\u5730 | \u5927\u591A\u662F\u6D41\u91CF\u6253\u6CD5\uFF0C\u73A9\u591A\u4E86\u6DA8\u6CDB\u7C89\uFF1B\u8BB2\u4E0D\u6E05\u6210\u4EA4\u7406\u7531\uFF0C\u4EBA\u8BBE\u4E0D\u591F\u6DF1 |

**\u600E\u4E48\u4E92\u8865**\uFF1A
- 36 \u8BA1\u7BA1**\u7247\u5B50\u91CC\u53D1\u751F\u4EC0\u4E48**\uFF08\u4E8B\u4EF6\u8D70\u5411\uFF09\uFF0C\u56DB\u5927\u811A\u672C\u7BA1**\u8BDD\u600E\u4E48\u8BB2**\uFF08\u7ED3\u6784\uFF09\uFF0C\u7206\u6B3E\u5143\u7D20\u7BA1**\u6807\u9898\u51ED\u4EC0\u4E48\u88AB\u70B9**\u2014\u2014\u4E09\u5C42\u53EF\u4EE5\u53E0\u5728\u540C\u4E00\u6761\u4E0A
- \u56DB\u5927\u811A\u672C\u7684\u9009\u9898\u60F3\u4E0D\u51FA\u3001\u53E3\u64AD\u8BB2\u4E0D\u52A8\u65F6\uFF0C\u6362\u4E00\u8BA1\u6765\u62CD\uFF1A\u540C\u6837\u8BB2"\u88C5\u4FEE\u907F\u5751"\uFF0C\u53E3\u64AD\u8BB2\u4E0D\u52A8\uFF0C\u5C31\u7528\u300C\u6B63\u786E\u505A\u6CD5VS\u9519\u8BEF\u505A\u6CD5\u300D\u73B0\u573A\u6F14\u4E00\u904D
- 36 \u8BA1\u7684\u7247\u5B50\u53EA\u6709\u6D41\u91CF\u3001\u6CA1\u6709\u8F6C\u5316\u65F6\uFF0C\u7528\u56DB\u5927\u811A\u672C\u7684\u7ED3\u6784\u8865\u4E0A\uFF1A\u540C\u6837\u662F\u300C\u5BF9\u6BD4\u6539\u9020\u300D\uFF0C\u6309\u300C\u6652\u8FC7\u7A0B\xB7\u706B\u8F66\u8282\u300D\u8BB2\uFF0C\u7ED3\u5C3E\u843D\u5728\u4E00\u4E2A\u6210\u4EA4\u7406\u7531\u4E0A

**\u8BA1\u548C\u811A\u672C\u600E\u4E48\u914D**\uFF08\u6309\u8FD9\u4E00\u8BA1\u9002\u5408\u7684\u76EE\u7684\uFF09\uFF1A
- \u53D8\u73B0\u578B\u7684\u8BA1 \u2192 \u914D \u6559\u77E5\u8BC6\xB7\u89E3\u9898\u578B / \u6652\u8FC7\u7A0B\xB7\u706B\u8F66\u8282 / \u8BB2\u6545\u4E8B\xB7\u6210\u529F\u6848\u4F8B
- \u4EBA\u8BBE\u578B\u7684\u8BA1 \u2192 \u914D \u8BB2\u6545\u4E8B\uFF08\u5C0F\u6709\u6210\u5C31\u3001\u5E73\u51E1\u82F1\u96C4\u3001\u8D35\u4EBA\u76F8\u52A9\u2026\u2026\uFF09
- \u6D41\u91CF\u578B\u7684\u8BA1 \u2192 \u914D \u804A\u89C2\u70B9\uFF0C\u6216\u8005\u76F4\u63A5\u6309\u8FD9\u4E00\u8BA1\u7684\u516C\u5F0F\u62CD\uFF0C\u4E0D\u53E6\u5957\u811A\u672C

**\u7528\u8BA1\u7684\u786C\u8981\u6C42**\uFF1A\u8BA1\u540D\u548C\u4E0B\u9762\u6E05\u5355\u4E00\u5B57\u4E0D\u5DEE\uFF1B\u90A3\u4E00\u8BA1\u7684\u7ED3\u6784\u516C\u5F0F\u8981\u843D\u5728\u7247\u5B50\u7684**\u4E8B\u4EF6**\u4E0A\uFF0C\u4E0D\u662F\u53EA\u5728\u6807\u9898\u91CC\u63D0\u4E00\u53E5\uFF1B
\u6311\u4ED6\u62CD\u5F97\u51FA\u6765\u7684\uFF08\u4E00\u4E2A\u4EBA\u3001\u4E00\u90E8\u624B\u673A\u62CD\u4E0D\u4E86\u591A\u4EBA\u5267\u60C5\uFF09\u3002`;
function tacticIndex(opts = {}) {
  const roles = opts.roles?.length ? opts.roles : CONTENT_ROLE_LIST;
  const exclude = new Set(opts.exclude ?? []);
  const lines = GROWTH_TACTICS.filter((t) => !exclude.has(t.name)).filter((t) => {
    const r = roleOfTactic(t.name);
    return r ? roles.includes(r) : true;
  }).map((t) => `- \u7B2C${t.no}\u8BA1 **${t.name}**\u3010${roleOfTactic(t.name) ?? "\u6D41\u91CF\u578B"}\u3011\uFF1A${t.formula}\uFF08\u9002\u5408\uFF1A${t.fit}\uFF09`);
  return `#### \u8D77\u53F7 36 \u8BA1\u6E05\u5355\uFF08\u8BA1\u540D\u3010\u6700\u9002\u5408\u7684\u76EE\u7684\u3011\uFF1A\u7ED3\u6784\u516C\u5F0F\uFF09

${lines.join("\n")}`;
}
var NAMES_LONGEST_FIRST = GROWTH_TACTICS.map((t) => t.name).sort((a, b) => b.length - a.length);
var BLOCKING_RULES = [
  { tactic: "\u5185\u5E55\u63ED\u79D8", when: /揭秘|内幕|黑料/ },
  { tactic: "\u6574\u86CA", when: /整蛊|恶搞/ }
];
function tacticsBlockedBy(restrictions) {
  const text3 = restrictions || "";
  return BLOCKING_RULES.filter((r) => r.when.test(text3)).map((r) => r.tactic);
}
var TACTIC_COUNT_BY_ROLE = Object.fromEntries(
  CONTENT_ROLE_LIST.map((r) => [r, TACTIC_ROLES[r].length])
);

// .tmp/content-audit-production_20261008/lib/profile-summary.ts
var asText = (v, fallback = "") => {
  if (v == null) return fallback;
  const s = Array.isArray(v) ? v.filter(Boolean).join("\u3001") : String(v);
  return s.trim() || fallback;
};
var PROFILE_SUMMARY_FIELDS = [
  ["account_platform", "\u5E73\u53F0"],
  ["account_track", "\u8D5B\u9053"],
  ["account_stage", "\u8D26\u53F7\u9636\u6BB5"],
  ["fans_level", "\u7C89\u4E1D\u91CF\u7EA7"],
  ["viral_content_pattern", "\u6570\u636E\u6700\u597D\u7684\u5185\u5BB9\u7C7B\u578B\uFF08\u5B9A\u4E3B\u6253\u5185\u5BB9\u7684\u9996\u8981\u4F9D\u636E\uFF09"],
  ["target_region", "\u5730\u57DF"],
  ["target_age", "\u76EE\u6807\u5E74\u9F84"],
  ["target_gender", "\u76EE\u6807\u6027\u522B"],
  ["target_occupation", "\u76EE\u6807\u804C\u4E1A"],
  ["target_interests", "\u76EE\u6807\u4EBA\u7FA4\u7684\u5174\u8DA3"],
  ["target_pain_points", "\u5BA2\u4EBA\u6700\u62C5\u5FC3"],
  ["target_needs", "\u4ED6\u4EEC\u771F\u6B63\u60F3\u8981"],
  ["fan_common_questions", "\u5BA2\u4EBA\u5E38\u95EE"],
  ["content_category", "\u5185\u5BB9\u7C7B\u522B"],
  ["content_themes", "\u5DF2\u6709\u7684\u5185\u5BB9\u65B9\u5411"],
  ["content_value", "\u60F3\u8BA9\u89C2\u4F17\u53D1\u751F\u7684\u53D8\u5316"],
  ["unique_selling_point", "\u6838\u5FC3\u5356\u70B9"],
  ["competitive_advantage", "\u7ADE\u4E89\u4F18\u52BF"],
  ["competitive_weakness", "\u76EE\u524D\u7684\u77ED\u677F"],
  ["unique_resources", "\u624B\u4E0A\u7684\u8D44\u6E90"],
  ["reference_accounts", "\u53C2\u8003\u8D26\u53F7"],
  ["content_style", "\u5185\u5BB9\u98CE\u683C"],
  ["content_tone", "\u8BED\u8A00\u98CE\u683C"],
  ["content_format", "\u5185\u5BB9\u5F62\u5F0F"],
  ["video_duration", "\u89C6\u9891\u65F6\u957F"],
  ["team_structure", "\u56E2\u961F"],
  ["equipment", "\u8BBE\u5907"],
  ["shooting_location", "\u573A\u5730"],
  ["editing_capability", "\u540E\u671F\u80FD\u529B"],
  ["budget_per_video", "\u5355\u6761\u9884\u7B97"],
  ["monetization_model", "\u53D8\u73B0\u65B9\u5F0F"],
  ["product_category", "\u5356\u7684\u4EA7\u54C1/\u670D\u52A1"],
  ["price_range", "\u4EF7\u683C\u533A\u95F4"],
  ["conversion_path", "\u6210\u4EA4\u8DEF\u5F84"],
  ["conversion_hooks", "\u8F6C\u5316\u94A9\u5B50"],
  ["conversion_barriers", "\u6210\u4EA4\u969C\u788D"],
  ["avoid_content", "\u4E0D\u60F3\u62CD\u7684\u5185\u5BB9"],
  // 前采建档提取出来、档案字段装不下的：老板经历、招牌产品、真实数据、客户原话。
  // 放最后：前面的字段是"是什么"，这里是"凭什么信"的素材
  ["interview_highlights", "\u524D\u91C7\u8981\u70B9\uFF08\u5BA2\u6237\u539F\u8BDD\u548C\u771F\u5B9E\u7EC6\u8282\uFF0C\u5199\u5185\u5BB9\u65F6\u4F18\u5148\u7528\uFF09"]
];
var listOf = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x) => x.trim()).filter(Boolean) : typeof v === "string" ? v.split(/[、,，]/).map((x) => x.trim()).filter(Boolean) : [];
var BUSINESS_LINES_LABEL = "- \u7ECF\u8425\u54C1\u7C7B\uFF08\u6BCF\u4E00\u4E2A\u90FD\u5728\u5356\uFF0C\u5B9A\u4F4D\u91CC\u90FD\u8981\u4F53\u73B0\uFF09\uFF1A";
function businessLines(p) {
  const generic = /* @__PURE__ */ new Set([...PROFILE_CHOICES.product_category, ...PROFILE_CHOICES.account_track]);
  const all = [...listOf(p.product_category), ...listOf(p.account_track)].filter((x) => !generic.has(x));
  return Array.from(new Set(all));
}
function buildProfileSummary(profile) {
  const p = scrubProfile(profile, readTabooSettings(profile.taboo_settings).excluded) ?? profile;
  const lines = [`- \u6863\u6848\u540D\u79F0\uFF1A${asText(p.profile_name, "\u672A\u547D\u540D")}`];
  const persona = personaFactsBlock(profile.persona_facts);
  if (persona) lines.push("", persona, "");
  const products = businessLines(p);
  if (products.length) lines.push(`${BUSINESS_LINES_LABEL}${products.join("\u3001")}`);
  for (const [key, label] of PROFILE_SUMMARY_FIELDS) {
    const t = asText(p[key]);
    if (t) lines.push(`- ${label}\uFF1A${t}`);
  }
  return lines.join("\n");
}

// .tmp/content-audit-production_20261008/lib/positioning-standards.ts
var AUDIENCE_CHANGE = `### \u5148\u7ACB\u6807\u5C3A\uFF1A\u5185\u5BB9\u8981\u8BA9\u89C2\u4F17\u53D1\u751F"\u53D8\u5316"

\u4E00\u6761\u5185\u5BB9\u6709\u6CA1\u6709\u4EF7\u503C\uFF0C\u4E0D\u770B\u6587\u6848\u6F02\u4E0D\u6F02\u4EAE\uFF0C\u770B\u89C2\u4F17\u770B\u5B8C\u6709\u6CA1\u6709\u53D1\u751F\u53EF\u611F\u77E5\u7684\u53D8\u5316\u3002
\u4E0B\u9762\u6BCF\u4E00\u79CD\u53D8\u5316\u5BF9\u5E94\u4E0D\u540C\u7684\u5185\u5BB9\u673A\u5236\u548C\u7528\u6237\u52A8\u4F5C\u2014\u2014**\u4F60\u63D0\u7684\u6BCF\u4E2A\u5185\u5BB9\u65B9\u5411\uFF0C
\u90FD\u8981\u80FD\u8BF4\u51FA\u5B83\u8BA9\u89C2\u4F17\u53D1\u751F\u54EA\u4E00\u79CD\u53D8\u5316**\uFF0C\u8BF4\u4E0D\u51FA\u6765\u7684\u5C31\u662F\u81EA\u55E8\u3002

| \u89C2\u4F17\u53D8\u5316 | \u5178\u578B\u611F\u53D7 | \u5185\u5BB9\u673A\u5236 | \u89C2\u4F17\u4F1A\u505A\u4EC0\u4E48 |
|---|---|---|---|
| \u8BA4\u77E5\u53D8\u5316 | \u539F\u6765\u5982\u6B64\u3001\u957F\u89C1\u8BC6 | \u77E5\u8BC6\u3001\u53CD\u8BA4\u77E5\u3001\u51B7\u77E5\u8BC6\u3001\u5185\u5E55 | \u6536\u85CF\u3001\u5173\u6CE8 |
| \u60C5\u7EEA\u53D8\u5316 | \u723D\u3001\u7B11\u3001\u611F\u52A8\u3001\u6124\u6012\u3001\u6CBB\u6108 | \u89C2\u70B9\u3001\u6545\u4E8B\u3001\u51B2\u7A81\u3001\u53CD\u8F6C | \u8BC4\u8BBA\u3001\u8F6C\u53D1 |
| \u884C\u52A8\u53D8\u5316 | \u6211\u73B0\u5728\u5C31\u80FD\u505A | \u6B65\u9AA4\u3001\u6E05\u5355\u3001\u6F14\u793A\u3001\u5BF9\u6BD4 | \u4FDD\u5B58\u3001\u5C1D\u8BD5 |
| \u8EAB\u4EFD\u786E\u8BA4 | \u8FD9\u8BF4\u7684\u4E0D\u5C31\u662F\u6211 | \u5708\u4EBA\u3001\u5171\u9E23\u3001\u5730\u57DF/\u804C\u4E1A\u6807\u7B7E | \u4E92\u52A8\u3001\u5173\u6CE8 |
| \u4FE1\u4EFB\u53D8\u5316 | \u8FD9\u4E2A\u4EBA\u61C2\u6211\u4E14\u505A\u5F97\u5230 | \u6848\u4F8B\u3001\u8FC7\u7A0B\u3001\u7ED3\u679C\u3001\u8FB9\u754C | \u54A8\u8BE2\u3001\u8D2D\u4E70 |

\u6CE8\u610F\u6700\u540E\u4E00\u884C\uFF1A**\u53EA\u6709"\u4FE1\u4EFB\u53D8\u5316"\u76F4\u63A5\u901A\u5411\u6210\u4EA4**\u3002\u4E00\u4E2A\u53F7\u5982\u679C\u53EA\u4F1A\u505A\u60C5\u7EEA\u5171\u9E23\uFF0C
\u4F1A\u6536\u83B7\u559C\u6B22\u4F46\u62FF\u4E0D\u5230\u4E13\u4E1A\u4FE1\u4EFB\uFF0C\u5356\u4E0D\u52A8\u9700\u8981\u51B3\u7B56\u7684\u4EA7\u54C1\u3002`;
var AGENCY_STANCE = `## \u{1F3AF} \u4F60\u7684\u7ACB\u573A\uFF1A\u4E0D\u662F\u5199\u62A5\u544A\uFF0C\u662F\u8981\u63A5\u624B\u8FD9\u4E2A\u53F7

\u4F60\u4E0D\u662F\u7ED9\u5BA2\u6237\u4EA4\u4E00\u4EFD\u54A8\u8BE2\u62A5\u544A\u7684\u987E\u95EE\uFF0C\u4F60\u662F**\u4E0B\u5468\u5C31\u8981\u63A5\u624B\u8FD9\u4E2A\u53F7\u53BB\u8FD0\u8425\u7684\u4EE3\u8FD0\u8425\u7F16\u5BFC**\u3002
\u65B9\u6848\u5199\u5B8C\uFF0C\u62CD\u6444\u3001\u53D1\u5E03\u3001\u590D\u76D8\u90FD\u5F97\u4F60\u81EA\u5DF1\u625B\u3002\u6240\u4EE5\uFF1A

- \u6BCF\u4E2A\u5224\u65AD\u90FD\u8981\u7ECF\u5F97\u8D77"\u90A3\u4F60\u8BF4\u5177\u4F53\u600E\u4E48\u62CD"\u7684\u8FFD\u95EE
- \u505A\u4E0D\u5230\u7684\u4E8B\u76F4\u63A5\u8BF4\u505A\u4E0D\u5230\uFF0C\u4E0D\u8981\u4E3A\u4E86\u65B9\u6848\u597D\u770B\u5F00\u7A7A\u5934\u652F\u7968
- \u8981\u6709\u53D6\u820D\uFF1A\u5148\u505A\u4EC0\u4E48\u3001**\u660E\u786E\u4E0D\u505A\u4EC0\u4E48**\uFF0C\u4EE5\u53CA\u4E3A\u4EC0\u4E48

### \u6863\u6848\u53EA\u662F\u7C97\u63CF\uFF0C\u4F60\u8981\u8865\u4E0A\u8FD9\u884C\u7684\u8BA4\u77E5

\u7528\u6237\u586B\u7684\u90A3\u4EFD\u6863\u6848\uFF0C\u76F8\u5F53\u4E8E\u7B7E\u7EA6\u524D\u7684\u4E00\u6B21\u7B80\u5355\u6478\u5E95\u3002\u771F\u6B63\u503C\u94B1\u7684\u4E1C\u897F\u5728\u540E\u9762\u2014\u2014
\u63A5\u624B\u4E00\u4E2A\u65B0\u5BA2\u6237\uFF0C\u6211\u4EEC\u4F1A\u505A\u524D\u91C7\u8BBF\u8C08\u3001\u95E8\u5E97\u52D8\u5BDF\u3001\u7ADE\u54C1\u7814\u7A76\u3002\u4F60\u73B0\u5728\u505A\u4E0D\u4E86\u8FD9\u4E09\u4EF6\u4E8B\uFF0C
**\u4F46\u4F60\u77E5\u9053\u8FD9\u4E00\u884C\u5927\u6982\u662F\u600E\u4E48\u56DE\u4E8B**\u3002\u6240\u4EE5\u8BF7\u4F60\u628A\u8FD9\u90E8\u5206\u8865\u51FA\u6765\uFF1A

\u524D\u91C7\u4F1A\u95EE\u7684\u95EE\u9898\uFF08\u4F60\u6309\u884C\u4E1A\u5E38\u8BC6\u5148\u7ED9\u51FA\u5224\u65AD\uFF0C\u5E76\u6807\u660E\u8FD9\u662F\u63A8\u6D4B\u3001\u7B49\u8001\u677F\u786E\u8BA4\uFF09\uFF1A
- \u8001\u677F\u4ECE\u4E1A\u591A\u5C11\u5E74\u3001\u4E3A\u4EC0\u4E48\u505A\u8FD9\u884C\u3001\u6700\u81EA\u8C6A\u7684\u662F\u4EC0\u4E48
- **\u771F\u6B63\u7684\u5DEE\u5F02\u5316\u5728\u54EA\u91CC\u2014\u2014\u6CE8\u610F\u662F\u987E\u5BA2\u611F\u53D7\u5230\u7684\uFF0C\u4E0D\u662F\u8001\u677F\u4EE5\u4E3A\u7684**
  \uFF08\u8FD9\u4E24\u8005\u7ECF\u5E38\u4E0D\u4E00\u6837\uFF1A\u8001\u677F\u89C9\u5F97\u81EA\u5DF1\u7528\u6599\u597D\uFF0C\u987E\u5BA2\u5176\u5B9E\u662F\u51B2\u7740\u8001\u677F\u4EBA\u5B9E\u5728\u6765\u7684\uFF09
- \u73B0\u5728\u5B9E\u9645\u6765\u7684\u662F\u4EC0\u4E48\u4EBA\uFF0C\u548C\u8001\u677F\u60F3\u5438\u5F15\u7684\u4EBA\u662F\u4E0D\u662F\u540C\u4E00\u6279
- \u5E97\u91CC\u6709\u6CA1\u6709\u771F\u5B9E\u53D1\u751F\u8FC7\u7684\u3001\u6709\u610F\u601D\u6216\u8005\u611F\u4EBA\u7684\u4E8B
- \u8001\u677F\u6700\u60F3\u8DDF\u65B0\u987E\u5BA2\u8BF4\u7684\u4E00\u53E5\u8BDD\u662F\u4EC0\u4E48

**\u8FD9\u5C31\u662F"\u6269\u6563"\u7684\u610F\u601D**\uFF1A\u628A\u7528\u6237\u6CA1\u5199\u51FA\u6765\u3001\u4F46\u4ED6\u4E00\u770B\u5C31\u4F1A\u8BF4"\u5BF9\uFF0C\u5C31\u662F\u8FD9\u6837"\u7684\u4E1C\u897F\u8BF4\u51FA\u6765\u3002
\u8BF4\u9519\u4E86\u4E0D\u8981\u7D27\u2014\u2014\u6807\u660E\u662F\u63A8\u6D4B\uFF0C\u8BF7\u4ED6\u7EA0\u6B63\uFF1B\u4E00\u53E5\u90FD\u4E0D\u6562\u8BF4\u624D\u662F\u771F\u7684\u6CA1\u7528\u3002`;
var INDUSTRY_LENS = `### \u7B2C\u4E00\u6B65\uFF1A\u5148\u8BA4\u51C6\u8FD9\u662F\u4EC0\u4E48\u4E3B\u4F53\u7684\u8D26\u53F7

**\u8FD9\u4E00\u6B65\u5224\u65AD\u9519\uFF0C\u540E\u9762\u5168\u9519\u3002** \u4E0D\u8981\u9ED8\u8BA4\u6240\u6709\u8D26\u53F7\u90FD\u662F\u5B9E\u4F53\u5E97\u2014\u2014
\u505A\u4EE3\u8FD0\u8425\u7684\u3001\u505A\u77E5\u8BC6\u4ED8\u8D39\u7684\u3001\u505A\u7535\u5546\u7684\uFF0C\u884C\u4E1A\u903B\u8F91\u5B8C\u5168\u4E0D\u540C\u3002

| \u4E3B\u4F53\u7C7B\u578B | \u7279\u5F81 | \u5BA2\u6237/\u89C2\u4F17\u662F\u8C01 |
|---|---|---|
| **A \u672C\u5730\u5B9E\u4F53\u5E97** | \u6709\u95E8\u5E97\uFF0C\u8981\u4EBA\u5230\u5E97\u6D88\u8D39 | \u672C\u5730\u6D88\u8D39\u8005 |
| **B \u670D\u52A1\u5546 / \u4EE3\u8FD0\u8425 / to B \u672C\u5730\u670D\u52A1** | \u5356\u7684\u662F\u670D\u52A1\uFF0C\u5BA2\u6237\u662F\u5546\u5BB6\u8001\u677F | **\u5E97\u8001\u677F\uFF0C\u4E0D\u662F\u6D88\u8D39\u8005** |
| **C \u4E2A\u4EBA IP / \u77E5\u8BC6\u535A\u4E3B** | \u5356\u8BFE\u3001\u5356\u54A8\u8BE2\u3001\u63A5\u5E7F\u544A | \u60F3\u5B66\u4E1C\u897F\u7684\u540C\u884C\u6216\u65B0\u624B |
| **D \u7535\u5546 / \u5E26\u8D27** | \u7EBF\u4E0A\u6210\u4EA4\uFF0C\u53D1\u8D27\u5230\u5BB6 | \u5168\u56FD\u8303\u56F4\u7684\u4E70\u5BB6 |

\u5224\u65AD\u4F9D\u636E\u770B\u8D5B\u9053\u548C\u53D8\u73B0\u65B9\u5F0F\uFF0C**\u4E0D\u8981\u770B\u4ED6\u670D\u52A1\u7684\u5BA2\u6237\u662F\u4EC0\u4E48\u884C\u4E1A**\u2014\u2014
\u4E00\u4E2A\u7ED9\u706B\u9505\u5E97\u505A\u4EE3\u8FD0\u8425\u7684\u8D26\u53F7\uFF0C\u4E3B\u4F53\u7C7B\u578B\u662F B \u4E0D\u662F A\uFF0C\u4ED6\u81EA\u5DF1\u4E0D\u5356\u706B\u9505\u3002

**\u53EF\u4EE5\u662F\u6DF7\u5408\u578B\uFF0C\u4E0D\u8981\u786C\u585E\u8FDB\u4E00\u7C7B\u3002** \u4E00\u4E2A\u4EBA\u65E2\u63A5\u4EE3\u8FD0\u8425\uFF08B\uFF09\u3001\u53C8\u505A\u4E2A\u4EBA IP \u535A\u4E3B\uFF08C\uFF09\u5F88\u5E38\u89C1\u3002
\u9010\u9879\u770B\u6863\u6848\u91CC\u7684\u53D8\u73B0\u65B9\u5F0F\u5404\u81EA\u9760\u4EC0\u4E48\uFF1A
- \u5E7F\u544A\u53D8\u73B0\u3001\u5E26\u8D27\u4F63\u91D1\u3001\u5356\u8BFE / \u5356\u5DE5\u5177 \u2192 \u9760**\u5927\u6D41\u91CF**\uFF0C\u6309 C / D \u7684\u903B\u8F91\u505A
- \u63A5\u672C\u5730\u5BA2\u6237\u7684\u670D\u52A1\u3001\u5230\u5E97\u6D88\u8D39 \u2192 \u9760**\u7CBE\u51C6**\uFF0C\u6309 A / B \u7684\u903B\u8F91\u505A

\u53D8\u73B0\u65B9\u5F0F\u6A2A\u8DE8\u4E24\u8FB9\u7684\uFF0C\u5C31\u662F\u6DF7\u5408\u578B\uFF1A\u5199\u660E**\u54EA\u6761\u662F\u4E3B\u7EBF\u3001\u54EA\u6761\u662F\u526F\u7EBF**\uFF0C\u4EE5\u53CA\u4E24\u6761\u7EBF\u600E\u4E48\u4E92\u76F8\u5582\u2014\u2014
\u901A\u5E38\u662F\u6D41\u91CF\u7EBF\u505A\u5F71\u54CD\u529B\uFF0C\u5F71\u54CD\u529B\u518D\u7ED9\u670D\u52A1\u7EBF\u80CC\u4E66\u3002
**\u7528\u6237\u8865\u5145\u8BF4\u660E\u91CC\u5199\u4E86"\u505A\u535A\u4E3B / \u6709\u5F71\u54CD\u529B\u7684 IP / \u8981\u5927\u6D41\u91CF"\u7684\uFF0C\u6D41\u91CF\u7EBF\u5FC5\u987B\u662F\u4E3B\u7EBF\u4E4B\u4E00**\uFF0C
\u4E0D\u80FD\u628A\u4ED6\u5224\u6210\u7EAF to B \u670D\u52A1\u53F7\u3002

---

**\u5982\u679C\u662F A\uFF08\u672C\u5730\u5B9E\u4F53\u5E97\uFF09**\uFF0C\u6309\u4E0B\u9762 12 \u7C7B\u5F52\u53E3\uFF08\u8DE8\u7C7B\u7684\u8BF4\u660E\u4E3B\u6B21\uFF09\uFF1A

| \u7C7B | \u4EE3\u8868\u4E1A\u6001 | \u7C7B | \u4EE3\u8868\u4E1A\u6001 |
|---|---|---|---|
| A \u9910\u996E\u98DF\u54C1 | \u9910\u5385/\u706B\u9505/\u70E7\u70E4/\u5C0F\u5403/\u5976\u8336/\u70D8\u7119/\u751F\u9C9C/\u5364\u5473 | G \u8FD0\u52A8\u5065\u8EAB | \u5065\u8EAB\u623F/\u745C\u4F3D/\u6E38\u6CF3/\u640F\u51FB/\u821E\u8E48 |
| B \u670D\u88C5\u978B\u5305 | \u670D\u88C5/\u978B\u5E97/\u7BB1\u5305/\u9996\u9970/\u5185\u8863 | H \u6C7D\u8F66\u670D\u52A1 | 4S/\u6C7D\u4FEE\u4FDD\u517B/\u6D17\u8F66/\u8D34\u819C/\u4E8C\u624B\u8F66 |
| C \u7F8E\u5BB9\u7F8E\u4F53 | \u7406\u53D1/\u7F8E\u7532/\u7F8E\u5BB9\u9662/\u533B\u7F8E/\u51CF\u8102 | I \u6BCD\u5A74\u4EB2\u5B50 | \u6BCD\u5A74\u7528\u54C1/\u65E9\u6559/\u513F\u7AE5\u6444\u5F71/\u6708\u5B50\u4E2D\u5FC3 |
| D \u5BB6\u5C45\u5BB6\u7535 | \u5BB6\u5177/\u5BB6\u7535/\u5EFA\u6750/\u88C5\u4FEE/\u5BB6\u653F | J \u5BA0\u7269\u5168\u94FE | \u5BA0\u7269\u5E97/\u5BA0\u7269\u533B\u9662/\u7F8E\u5BB9/\u5BC4\u517B |
| E \u6559\u80B2\u57F9\u8BAD | \u5B66\u79D1/\u827A\u672F/\u4F53\u80B2/\u804C\u4E1A\u6280\u80FD/\u65E9\u6559 | K \u4F11\u95F2\u5A31\u4E50 | KTV/\u5BC6\u5BA4/\u5267\u672C\u6740/\u53F0\u7403/\u7535\u7ADE |
| F \u5065\u5EB7\u533B\u7597 | \u836F\u5E97/\u53E3\u8154/\u773C\u955C/\u4E2D\u533B\u9986/\u5EB7\u590D | L \u793C\u54C1\u6587\u521B | \u82B1\u5E97/\u73E0\u5B9D/\u6444\u5F71\u9986/\u6587\u521B/\u5A5A\u5E86 |

**A \u7C7B\u8981\u8BF4\u51FA\u8FD9\u51E0\u4EF6\u4E8B**\uFF08\u6863\u6848\u91CC\u6CA1\u6709\uFF0C\u9760\u4F60\u7684\u884C\u4E1A\u8BA4\u77E5\uFF09\uFF1A
- \u8FD9\u884C\u7684\u94B1\u600E\u4E48\u8D5A\uFF1A\u6BDB\u5229\u7ED3\u6784\u3001\u9760\u5BA2\u5355\u8FD8\u662F\u9760\u590D\u8D2D\u3001\u83B7\u5BA2\u6210\u672C\u5361\u5728\u54EA
- \u5BA2\u4EBA\u7684\u51B3\u7B56\u94FE\u8DEF\u6709\u591A\u957F\uFF1A\u770B\u5B8C\u5C31\u6765\uFF0C\u8FD8\u662F\u8981\u6BD4\u4EF7\u3001\u95EE\u4EBA\u3001\u7B49\u65F6\u673A
- \u6DE1\u65FA\u5B63\u3001\u65F6\u6BB5\u89C4\u5F8B\u3001\u8282\u65E5\u8282\u70B9
- **\u8FD9\u884C\u8001\u677F\u666E\u904D\u4F1A\u72AF\u7684\u9519**\uFF1A\u6700\u5E38\u89C1\u7684\u81EA\u55E8\u70B9\u662F\u4EC0\u4E48
- \u540C\u884C\u8D26\u53F7\u73B0\u5728\u90FD\u5728\u62CD\u4EC0\u4E48\uFF0C\u4E3A\u4EC0\u4E48\u5927\u591A\u6CA1\u6548\u679C

---

**\u5982\u679C\u662F B\uFF08\u670D\u52A1\u5546 / \u4EE3\u8FD0\u8425 / to B \u672C\u5730\u670D\u52A1\uFF09**\uFF0C\u8981\u8BF4\u7684\u662F\u5B8C\u5168\u4E0D\u540C\u7684\u51E0\u4EF6\u4E8B\u3002
\u26A0\uFE0F **\u7EDD\u5BF9\u4E0D\u8981\u53BB\u8BB2\u4ED6\u5BA2\u6237\u90A3\u4E00\u884C\u7684\u6BDB\u5229\u548C\u6DE1\u65FA\u5B63**\u2014\u2014\u90A3\u662F\u4ED6\u5BA2\u6237\u5173\u5FC3\u7684\uFF0C\u4E0D\u662F\u4ED6\u5173\u5FC3\u7684\uFF1A

- **\u8FD9\u884C\u600E\u4E48\u6536\u8D39**\uFF1A\u6708\u8D39 / \u5355\u6761 / \u6253\u5305 / \u5206\u6210\uFF0C\u5BA2\u5355\u548C\u5408\u4F5C\u5468\u671F\u5927\u6982\u4EC0\u4E48\u91CF\u7EA7
- **\u5BA2\u6237\u4ECE\u54EA\u6765**\uFF1A\u540C\u57CE\u964C\u751F\u6D41\u91CF\u3001\u8F6C\u4ECB\u7ECD\u3001\u5E73\u53F0\u6D3E\u5355\u3001\u7EBF\u4E0B\u5730\u63A8\uFF0C\u54EA\u6761\u8DEF\u6700\u73B0\u5B9E
- **\u6700\u5927\u7684\u4FE1\u4EFB\u95E8\u69DB**\uFF1A\u8FD9\u884C\u7684\u5BA2\u6237**\u5927\u591A\u88AB\u5751\u8FC7**\u2014\u2014\u4E0A\u4E00\u4E2A\u4EE3\u8FD0\u8425\u6536\u4E86\u94B1\u6CA1\u6548\u679C\u3002
  \u6240\u4EE5\u7B2C\u4E00\u5173\u4E0D\u662F"\u4F60\u4E13\u4E0D\u4E13\u4E1A"\uFF0C\u662F"**\u4F60\u662F\u4E0D\u662F\u53C8\u4E00\u4E2A\u6765\u5272\u97ED\u83DC\u7684**"
- **\u5BA2\u6237\u4E3A\u4EC0\u4E48\u6D41\u5931**\uFF1A\u770B\u4E0D\u5230\u6548\u679C\u3001\u8001\u677F\u4E0D\u914D\u5408\u62CD\u6444\u3001\u671F\u5F85\u9519\u4F4D\uFF08\u4EE5\u4E3A\u6295\u4E86\u5C31\u7206\uFF09\u3001
  \u8D26\u671F\u62D6\u4E0D\u8D77\u3002\u8FD9\u51E0\u6761\u51B3\u5B9A\u4E86\u5185\u5BB9\u91CC\u8981\u63D0\u524D\u6253\u54EA\u4E9B\u9884\u9632\u9488
- **\u540C\u884C\u90FD\u5728\u600E\u4E48\u83B7\u5BA2**\uFF1A\u6652\u6570\u636E\u622A\u56FE\u3001\u8BB2\u65B9\u6CD5\u8BBA\u3001\u53D1\u7206\u6B3E\u6848\u4F8B\u2014\u2014
  \u4E3A\u4EC0\u4E48\u5927\u591A\u6570\u6CA1\u7528\uFF08\u8001\u677F\u770B\u4E0D\u61C2\u6570\u636E\uFF0C\u4E5F\u4E0D\u4FE1\u622A\u56FE\uFF09
- **\u53BF\u57DF / \u4E0B\u6C89\u5E02\u573A\u548C\u4E00\u4E8C\u7EBF\u7684\u5DEE\u522B**\uFF1A\u719F\u4EBA\u793E\u4F1A\u3001\u8F6C\u4ECB\u7ECD\u6743\u91CD\u6781\u9AD8\u3001
  \u51B3\u7B56\u770B\u4EBA\u4E0D\u770B\u65B9\u6848\u3001\u4EF7\u683C\u654F\u611F\u4F46\u66F4\u8BA4\u957F\u671F\u5173\u7CFB
- **\u8FD9\u884C\u540C\u884C\u666E\u904D\u7684\u9519**\uFF1A\u628A\u81EA\u5DF1\u5305\u88C5\u6210"\u5927\u5E08"\uFF0C\u6216\u8005\u6EE1\u5634\u672F\u8BED\uFF08\u5B8C\u64AD\u7387\u3001DOU+\u3001\u6295\u6D41\uFF09\uFF0C
  \u800C\u8001\u677F\u53EA\u5173\u5FC3"\u80FD\u4E0D\u80FD\u6765\u4EBA"

---

**\u5982\u679C\u662F C\uFF08\u4E2A\u4EBA IP / \u77E5\u8BC6\u535A\u4E3B\uFF09**\uFF1A\u8BB2\u8FD9\u4E2A\u7EC6\u5206\u9886\u57DF\u7684\u7ADE\u4E89\u5BC6\u5EA6\u3001
\u540C\u7C7B\u535A\u4E3B\u90FD\u5728\u8BB2\u4EC0\u4E48\u3001\u54EA\u4E9B\u5185\u5BB9\u5DF2\u7ECF\u88AB\u8BB2\u70C2\u3001\u4ED8\u8D39\u8F6C\u5316\u901A\u5E38\u5361\u5728\u54EA\u4E00\u6B65\u3002

**\u5982\u679C\u662F D\uFF08\u7535\u5546 / \u5E26\u8D27\uFF09**\uFF1A\u8BB2\u54C1\u7C7B\u7684\u4EF7\u683C\u5E26\u3001\u9000\u8D27\u7387\u3001
\u5E73\u53F0\u6D41\u91CF\u89C4\u5219\u3001\u540C\u7C7B\u5546\u54C1\u7684\u5185\u5BB9\u5957\u8DEF\u3002

### \u4EBA\u7FA4\u600E\u4E48\u5199\uFF08\u5206 to C \u548C to B\uFF09

**\u5982\u679C\u8D26\u53F7\u662F to C**\uFF08A \u7C7B\u5B9E\u4F53\u5E97\u3001D \u7C7B\u5E26\u8D27\uFF09\uFF0C\u4EBA\u7FA4\u843D\u5230\u4E0B\u9762\u516B\u7C7B\uFF0C\u4E0D\u8981\u5199\u5E74\u9F84\u6BB5\uFF1A

| \u4EBA\u7FA4\u8BCD\u6839 | \u6838\u5FC3\u7279\u5F81 | \u4E3B\u8981\u6D88\u8D39\u573A\u666F | \u4ED6\u4EEC\u770B\u91CD\u7684\u6210\u4EA4\u7406\u7531 |
|---|---|---|---|
| \u5C0F\u9547\u9752\u5E74 | \u672C\u5730\u5E74\u8F7B\u4EBA\uFF0C\u793E\u4EA4\u6D3B\u8DC3\uFF0C\u989C\u503C\u81F3\u4E0A | \u670B\u53CB\u805A\u4F1A/\u7EA6\u4F1A/\u53D1\u5708 | \u989C\u503C\u9AD8\xB7\u6709\u7279\u8272\xB7\u63A5\u5730\u6C14 |
| \u7CBE\u81F4\u5988\u5988 | \u5BB6\u5EAD\u51B3\u7B56\u8005\uFF0C\u91CD\u8D28\u91CF\u5B89\u5168 | \u5E26\u5B69\u5B50/\u63A5\u5F85\u7236\u6BCD/\u8282\u5047\u65E5 | \u54C1\u8D28\u597D\xB7\u5B89\u5168\u53EF\u4FE1\xB7\u9009\u6750\u4E25 |
| \u8D44\u6DF1\u4E2D\u4EA7 | \u91CD\u53E3\u7891\u8F7B\u4EF7\u683C\uFF0C\u4F53\u9A8C\u4E0E\u9762\u5B50\u5E76\u91CD | \u63A5\u5F85\u7236\u6BCD/\u62DB\u5F85\u670B\u53CB | \u53E3\u7891\u597D\xB7\u6709\u9762\u5B50\xB7\u4E13\u4E1A\u5F3A |
| Z\u4E16\u4EE3 | \u63A2\u5E97\u6253\u5361\uFF0C\u4F20\u64AD\u529B\u5F3A\uFF0C\u8FFD\u65B0\u5947 | \u7EA6\u4F1A/\u805A\u4F1A/\u6253\u5361 | \u989C\u503C\u9AD8\xB7\u7A00\u7F3A\u552F\u4E00\xB7\u6709\u7279\u8272 |
| \u65B0\u9510\u767D\u9886 | \u6D88\u8D39\u7406\u6027\uFF0C\u91CD\u6027\u4EF7\u6BD4 | \u804C\u573A\u6D88\u8D39/\u4E0B\u73ED/\u4E00\u4EBA\u98DF | \u6709\u9762\u5B50\xB7\u5B9E\u5728\u4E0D\u5751\xB7\u6027\u4EF7\u6BD4 |
| \u90FD\u5E02\u84DD\u9886 | \u52A1\u5B9E\uFF0C\u91CD\u5B9E\u60E0\uFF0C\u53E3\u7891\u4F18\u5148 | \u53D1\u5DE5\u8D44/\u4E0B\u73ED\u89E3\u538B | \u5B9E\u5728\u63A5\u5730\u6C14\xB7\u6027\u4EF7\u6BD4\xB7\u573A\u666F\u5168 |
| \u94F6\u53D1\u65CF | \u968F\u5BB6\u5EAD\u6D88\u8D39\uFF0C\u91CD\u5B89\u5168\u536B\u751F | \u5BB6\u5EAD\u805A\u4F1A/\u8282\u5047\u65E5/\u5065\u5EB7 | \u5B89\u5168\u653E\u5FC3\xB7\u5E72\u51C0\u536B\u751F\xB7\u4E13\u4E1A\u53EF\u9760 |
| \u5C0F\u9547\u4E2D\u8001\u5E74 | \u4FE1\u719F\u4EBA\u53E3\u7891\uFF0C\u53E3\u8033\u76F8\u4F20 | \u5BB6\u5EAD\u6D88\u8D39/\u62DB\u5F85\u719F\u4EBA | \u719F\u4EBA\u53E3\u7891\xB7\u5E74\u5934\u4E45\xB7\u5B9E\u5728\u4E0D\u5751 |

**\u9009 1-2 \u7C7B\u4F5C\u4E3A\u4E3B\u653B**\uFF0C\u8BF4\u660E\u4E3A\u4EC0\u4E48\u662F\u4ED6\u4EEC\u3001\u800C\u4E0D\u662F\u53E6\u5916\u51E0\u7C7B\u2014\u2014
\u8FD9\u6BD4\u5199"25-35\u5C81\u5973\u6027"\u6709\u7528\u4E00\u767E\u500D\u3002

---

**\u5982\u679C\u8D26\u53F7\u662F to B**\uFF08B \u7C7B\u670D\u52A1\u5546\u3001C \u7C7B\u77E5\u8BC6\u535A\u4E3B\uFF09\uFF0C\u4E0A\u9762\u90A3\u516B\u7C7B**\u4E0D\u9002\u7528**\uFF0C
\u56E0\u4E3A\u4F60\u7684\u89C2\u4F17\u662F\u8001\u677F\u6216\u540C\u884C\uFF0C\u4E0D\u662F\u6D88\u8D39\u8005\u3002\u8981\u843D\u5230\u8FD9\u51E0\u4E2A\u7EF4\u5EA6\uFF1A

- **\u4EC0\u4E48\u884C\u4E1A\u7684\u8001\u677F**\uFF1A\u9910\u996E\uFF1F\u7F8E\u5BB9\uFF1F\u6C7D\u4FEE\uFF1F\u8FD8\u662F\u4E0D\u9650\u884C\u4E1A\u4F46\u9650\u89C4\u6A21
- **\u4EC0\u4E48\u89C4\u6A21\u3001\u4EC0\u4E48\u9636\u6BB5**\uFF1A\u5355\u5E97\u8FD8\u662F\u8FDE\u9501\uFF1B\u521A\u5F00\u4E1A\u3001\u6491\u4E86\u51E0\u5E74\u8FD8\u662F\u5728\u8D70\u4E0B\u5761
- **\u4ED6\u73B0\u5728\u7684\u5904\u5883**\uFF1A\u81EA\u5DF1\u62CD\u8FC7\u6CA1\u6548\u679C / \u8BF7\u8FC7\u4EBA\u88AB\u5751\u8FC7 / \u8FD8\u6CA1\u5F00\u59CB\u4F46\u5728\u89C2\u671B / \u751F\u610F\u4E0B\u6ED1\u5728\u7740\u6025
- **\u4ED6\u7684\u5FC3\u7406\u72B6\u6001**\uFF1A\u88AB\u5751\u8FC7\u7684\u4EBA\u7B2C\u4E00\u53CD\u5E94\u662F\u6000\u7591\uFF0C\u4E0D\u662F\u597D\u5947\u3002
  **\u4ED6\u4E0D\u4F1A\u770B\u5B8C\u5C31\u627E\u4F60\uFF0C\u4ED6\u4F1A\u5148\u6F5C\u6C34\u89C2\u5BDF\u4F60\u5F88\u4E45**
- **\u4ED6\u4EC0\u4E48\u65F6\u5019\u4F1A\u60F3\u8D77\u4F60**\uFF1A\u751F\u610F\u6700\u6DE1\u7684\u90A3\u51E0\u5929\u3001\u770B\u5230\u540C\u884C\u706B\u4E86\u3001
  \u623F\u79DF\u5230\u671F\u8981\u7EED\u7EA6\u7684\u65F6\u5019\u2014\u2014\u8FD9\u4E9B\u65F6\u523B\u51B3\u5B9A\u4E86\u5185\u5BB9\u8BE5\u4EC0\u4E48\u65F6\u5019\u53D1\u3001\u53D1\u4EC0\u4E48

\u26A0\uFE0F **\u5982\u679C\u8FD9\u4E2A\u53F7\u552F\u4E00\u7684\u53D8\u73B0\u5C31\u662F\u63A5\u672C\u5730\u5BA2\u6237**\uFF0C\u6700\u5BB9\u6613\u72AF\u7684\u9519\u662F\u628A\u89C2\u4F17\u5F53\u6210"\u6CDB\u7C89"\u6765\u7ECF\u8425\u2014\u2014
\u4F60\u8981\u7684\u4E0D\u662F\u5341\u4E07\u4E2A\u770B\u70ED\u95F9\u7684\uFF0C\u662F\u672C\u5730\u51E0\u767E\u4E2A\u6709\u5E97\u7684\u8001\u677F\uFF1B\u4E00\u6761\u89C6\u9891 500 \u64AD\u653E\u4F46\u88AB 3 \u4E2A\u8001\u677F\u770B\u5230\u5E76\u79C1\u4FE1\uFF0C
\u6BD4 10 \u4E07\u64AD\u653E\u5168\u662F\u540C\u884C\u56F4\u89C2\u5F3A\u3002
**\u4F46\u8FD9\u6761\u53EA\u7BA1\u670D\u52A1\u7EBF\u3002** \u6DF7\u5408\u578B\u8D26\u53F7\u7684\u6D41\u91CF\u7EBF\u3001\u6216\u8005\u7528\u6237\u660E\u786E\u8981\u5927\u6D41\u91CF\u7684\uFF0C\u4E0D\u9002\u7528\u8FD9\u6761\u2014\u2014
\u6D41\u91CF\u7EBF\u7684\u4EFB\u52A1\u5C31\u662F\u8BA9\u66F4\u591A\u4EBA\u770B\u5230\uFF0C\u53EA\u8981\u5185\u5BB9\u548C\u4EBA\u8BBE\u4E00\u81F4\uFF0C\u6CDB\u6D41\u91CF\u5E26\u6765\u7684\u5F71\u54CD\u529B\u4F1A\u53CD\u8FC7\u6765\u7ED9\u670D\u52A1\u7EBF\u80CC\u4E66\u3002`;
var THREE_PRINCIPLES = `### \u518D\u7ACB\u4E00\u9053\u7B5B\u5B50\uFF1A\u6709\u7528\u5904 / \u6709\u5174\u8DA3 / \u6709\u5171\u9E23

\u4E00\u6761\u5185\u5BB9\u81F3\u5C11\u8981\u5360\u4E09\u8005\u4E4B\u4E00\uFF0C\u4E00\u6761\u90FD\u4E0D\u5360\u7684\u65B9\u5411\u76F4\u63A5\u780D\u6389\uFF1A

- **\u6709\u7528\u5904**\uFF1A\u7ED9\u51FA\u5B9E\u9645\u4EF7\u503C\u2014\u2014\u7701\u94B1\u3001\u7701\u4E8B\u3001\u907F\u5751\u3001\u80FD\u7167\u7740\u505A
- **\u6709\u5174\u8DA3**\uFF1A\u597D\u770B\u597D\u73A9\uFF0C\u613F\u610F\u770B\u4E0B\u53BB\u3001\u613F\u610F\u70B9\u8D5E
- **\u6709\u5171\u9E23**\uFF1A\u6233\u4E2D\u8EAB\u4EFD\u6216\u5904\u5883\uFF0C"\u8FD9\u8BF4\u7684\u4E0D\u5C31\u662F\u6211/\u6211\u4EEC\u8FD9\u884C"

\u5E38\u89C1\u7684\u7FFB\u8F66\u662F**\u53EA\u60F3\u7740\u5C55\u793A\u81EA\u5DF1\u7684\u4EA7\u54C1**\u3002\u7528\u6237\u4E0D\u5173\u5FC3\u4F60\u5356\u4EC0\u4E48\uFF0C
\u53EA\u5173\u5FC3\u8DDF\u4ED6\u6709\u4EC0\u4E48\u5173\u7CFB\u2014\u2014\u5148\u6709\u7528\u6237\u601D\u7EF4\uFF0C\u518D\u8C08\u4EA7\u54C1\u3002`;
var SIX_DIMENSIONS = `### \u516D\u7EF4\u5730\u57FA\uFF08IP\u5B9A\u4F4D\u8868\uFF09

\u5B9A\u4F4D\u4E0D\u662F\u4E00\u53E5 slogan\uFF0C\u662F\u516D\u4E2A\u4E92\u76F8\u54AC\u5408\u7684\u5224\u65AD\u3002\u516D\u7EF4\u7F3A\u4E00\u7EF4\uFF0C\u540E\u9762\u505A\u5185\u5BB9\u5C31\u4F1A\u53CD\u590D\u6447\u6446\u3002

| \u7EF4\u5EA6 | \u5173\u952E\u95EE\u9898 | \u5FC5\u987B\u8F93\u51FA |
|---|---|---|
| \u4EBA\u8BBE\u5B9A\u4F4D | \u4F60\u662F\u8C01\uFF0C\u522B\u4EBA\u600E\u6837\u8BB0\u4F4F\u4F60\uFF1F | \u804C\u4E1A/\u8EAB\u4EFD + \u7279\u8D28/\u7ECF\u5386 + \u7528\u6237\u75DB\u70B9 |
| \u7528\u6237\u5B9A\u4F4D | \u8C01\u6700\u9700\u8981\u3001\u6700\u613F\u770B\u3001\u6700\u53EF\u80FD\u4E70\uFF1F | \u573A\u666F\u5316\u4EBA\u7FA4\uFF0C\u4E0D\u662F\u7A7A\u6CDB\u7684\u5E74\u9F84\u6027\u522B |
| \u5185\u5BB9\u5B9A\u4F4D | \u957F\u671F\u63D0\u4F9B\u4EC0\u4E48\u4EF7\u503C\uFF1F | \u5185\u5BB9\u7C7B\u578B\u3001\u4E3B\u9898\u3001\u7CFB\u5217\u3001\u914D\u6BD4 |
| \u5448\u73B0\u5B9A\u4F4D | \u7528\u4EC0\u4E48\u65B9\u5F0F\u7A33\u5B9A\u751F\u4EA7\uFF1F | \u56FE\u6587/\u53E3\u64AD/Vlog/\u60C5\u666F\u5267\u7B49\uFF0C\u8981\u5339\u914D\u771F\u5B9E\u8D44\u6E90 |
| \u98CE\u683C\u8C03\u6027 | \u7528\u6237\u63A5\u89E6\u5230\u7684\u5168\u90E8\u5143\u7D20\u662F\u4EC0\u4E48\u6C14\u8D28\uFF1F | \u4ECE\u5934\u50CF\u5230\u8BED\u8A00\u8154\u8C03\uFF0C\u7EDF\u4E00\u6216\u6709\u610F\u53CD\u5DEE |
| \u53D8\u73B0\u5B9A\u4F4D | \u6700\u7EC8\u5356\u4EC0\u4E48\u3001\u9760\u4EC0\u4E48\u83B7\u5F97\u6536\u5165\uFF1F | \u4EA7\u54C1\u3001\u5BA2\u5355\u3001\u6210\u4EA4\u8DEF\u5F84\u3001\u4FE1\u4EFB\u8BC1\u636E |

**\u6838\u5FC3\u903B\u8F91**\uFF1A\u4EE5\u7279\u5B9A\u8EAB\u4EFD\uFF0C\u5728\u7279\u5B9A\u573A\u666F\u8BF4\u7279\u5B9A\u7684\u8BDD\uFF0C\u5438\u5F15\u7279\u5B9A\u4EBA\u7FA4\u4EA7\u751F\u4FE1\u4EFB\uFF0C
\u8FDB\u800C\u4FC3\u6210\u8D2D\u4E70\u3002\u516D\u7EF4\u5C31\u662F\u628A\u8FD9\u53E5\u8BDD\u62C6\u6210\u53EF\u6267\u884C\u7684\u516D\u4E2A\u51B3\u5B9A\u3002

\u26A0\uFE0F \u7528\u6237\u5B9A\u4F4D\u5199"25-35\u5C81\u5973\u6027"\u8FD9\u79CD\u662F\u65E0\u6548\u7684\u2014\u2014\u90A3\u662F\u4EBA\u53E3\u7EDF\u8BA1\uFF0C\u4E0D\u662F\u573A\u666F\u3002
\u8981\u5199\u6210"\u5B69\u5B50\u521A\u4E0A\u5C0F\u5B66\u3001\u6BCF\u5929\u7EA0\u7ED3\u665A\u996D\u505A\u4EC0\u4E48\u7684\u804C\u573A\u5988\u5988"\u8FD9\u79CD\u4E00\u773C\u80FD\u60F3\u5230\u5177\u4F53\u4EBA\u7684\u63CF\u8FF0\u3002`;
var PERSONA_ENTRIES = `### \u4EBA\u8BBE\u600E\u4E48\u7ACB\uFF1A\u4E03\u4E2A\u5165\u53E3\uFF0C\u6BCF\u4E2A\u90FD\u8981\u8FC7\u9A8C\u8BC1

\u4EBA\u8BBE\u4E0D\u662F\u7F16\u4E00\u4E2A\u5B8C\u7F8E\u89D2\u8272\uFF0C\u800C\u662F**\u9009\u62E9\u771F\u5B9E\u3001\u53EF\u6301\u7EED\u3001\u80FD\u88AB\u53CD\u590D\u8BC1\u660E\u7684\u4FA7\u9762**\u3002
\u6807\u7B7E\u8D8A\u5177\u4F53\u89C2\u4F17\u8D8A\u5BB9\u6613\u590D\u8FF0\uFF1B\u8BC1\u636E\u8D8A\u6301\u7EED\u4FE1\u4EFB\u8D8A\u7262\u3002

| \u5165\u53E3 | \u6784\u9020\u516C\u5F0F | \u5FC5\u987B\u901A\u8FC7\u7684\u9A8C\u8BC1 | \u793A\u4F8B |
|---|---|---|---|
| \u75DB\u70B9+\u804C\u4E1A | \u6700\u6015\u4EC0\u4E48 + \u6211\u80FD\u89E3\u51B3\u4EC0\u4E48 | \u662F\u5426\u662F\u9AD8\u9891\u771F\u75DB\u70B9\uFF1F | \u4E0D\u4F1A\u75BC\u7684\u7259\u533B |
| \u7279\u6B8A\u7ECF\u5386 | \u7F55\u89C1\u7ECF\u5386 + \u53EF\u8FC1\u79FB\u7ECF\u9A8C | \u80FD\u5426\u6301\u7EED\u8BB2\u7EC6\u8282\uFF0C\u800C\u4E0D\u662F\u4E00\u6B21\u6027\u5671\u5934\uFF1F | \u56DB\u6B21\u5256\u8179\u4EA7\u5988\u5988 |
| \u5916\u5F62/\u8EAB\u4EFD | \u663E\u8457\u7279\u5F81 + \u5185\u5BB9\u884C\u4E3A | \u662F\u5426\u4E00\u773C\u53EF\u89C1\u4E14\u4E0D\u5192\u72AF\uFF1F | 1.9\u7C73\u3001\u4FDD\u5B89\u5531\u6B4C |
| \u6027\u683C | \u7A33\u5B9A\u6001\u5EA6 + \u5178\u578B\u8BED\u8A00 | \u7EBF\u4E0B\u662F\u5426\u4E5F\u80FD\u4FDD\u6301\uFF1F | \u66B4\u8E81\u4F46\u52A1\u5B9E\u7684\u7559\u5B66\u5BFC\u5E08 |
| \u5173\u7CFB | \u4E24\u4EBA\u5173\u7CFB + \u7A33\u5B9A\u77DB\u76FE/\u6E29\u60C5 | \u5BF9\u65B9\u662F\u5426\u540C\u610F\u957F\u671F\u51FA\u955C\uFF1F | \u592B\u59BB\u3001\u7236\u5973\u3001\u5E08\u5F92 |
| \u53CD\u5DEE | \u5927\u4F17\u9884\u671FA + \u5B9E\u9645\u884C\u4E3AB | \u573A\u666F\u662F\u5426\u903B\u8F91\u81EA\u6D3D\uFF1F | \u533B\u751F\u8BB2\u88D9\u5B50 |

**\u4F60\u7ED9\u51FA\u7684\u4EBA\u8BBE\u5FC5\u987B\u5F53\u573A\u56DE\u7B54\u5B83\u5BF9\u5E94\u7684\u9A8C\u8BC1\u95EE\u9898**\uFF0C\u4E0D\u80FD\u53EA\u629B\u4E00\u4E2A\u6807\u7B7E\u5C31\u7B97\u5B8C\u3002
\u8FC7\u4E0D\u4E86\u9A8C\u8BC1\u7684\u4EBA\u8BBE\uFF0C\u62CD\u5230\u7B2C\u5341\u6761\u5C31\u6491\u4E0D\u4E0B\u53BB\u4E86\u3002`;
var PRESENTATION_FORMS = `### \u5448\u73B0\u5F62\u5F0F\uFF1A\u540C\u4E00\u4E2A\u77E5\u8BC6\u70B9\uFF0C\u7528\u4EC0\u4E48\u65B9\u5F0F\u8BB2

| \u5F62\u5F0F | \u4F18\u52BF | \u96BE\u70B9 | \u9002\u5408 |
|---|---|---|---|
| \u56FE\u6587 | \u4F4E\u6210\u672C\u3001\u4FE1\u606F\u6E05\u6670 | \u505C\u7559\u5168\u9760\u9996\u56FE\u548C\u6392\u7248 | \u6E05\u5355\u3001\u91D1\u53E5\u3001\u6B65\u9AA4 |
| \u53E3\u64AD | \u4FE1\u4EFB\u76F4\u63A5\u3001\u751F\u4EA7\u7A33\u5B9A | \u8868\u73B0\u529B\u3001\u8BED\u8A00\u3001\u573A\u666F | \u77E5\u8BC6\u3001\u89C2\u70B9\u3001\u6545\u4E8B |
| \u89C6\u9891+\u914D\u97F3 / Vlog | \u753B\u9762\u4E30\u5BCC\u3001\u8FC7\u7A0B\u611F\u5F3A | \u7D20\u6750\u4E0E\u65C1\u767D\u8981\u540C\u6B65 | \u63A2\u5E97\u3001\u6D4B\u8BC4\u3001\u6559\u7A0B |
| \u60C5\u666F\u5267 | \u4EE3\u5165\u5F3A\u3001\u5A31\u4E50\u6027\u9AD8 | \u5267\u672C\u3001\u8868\u6F14\u3001\u8C03\u5EA6\u3001\u526A\u8F91 | \u77E5\u8BC6\u6F14\u7ECE\u3001\u6BB5\u5B50\u3001\u5173\u7CFB\u5185\u5BB9 |

\u9009\u62E9\u65F6\u8981\u540C\u65F6\u770B\u56DB\u4EF6\u4E8B\uFF1A\u6D41\u91CF\u6F5C\u529B\u3001\u76EE\u6807\u7528\u6237\u3001\u4E2A\u4EBA\u6C14\u8D28\u3001**\u7A33\u5B9A\u4EA7\u80FD**\u3002
\u26A0\uFE0F \u60C5\u666F\u5267\u770B\u7740\u6700\u5438\u5F15\u4EBA\uFF0C\u4F46\u96BE\u5EA6\u6700\u9AD8\u3002**\u8D44\u6E90\u4E0D\u8DB3\u65F6\uFF0C\u9AD8\u8D28\u91CF\u53E3\u64AD\u8FDC\u80DC\u7C97\u7CD9\u5267\u60C5**\u2014\u2014
\u8FD9\u662F\u6700\u5E38\u89C1\u7684\u8BEF\u5224\uFF0C\u5F88\u591A\u53F7\u6B7B\u5728\u4E00\u5F00\u59CB\u5C31\u60F3\u62CD\u5267\u3002

**\u60C5\u5883\u771F\u5B9E**\uFF08\u51B3\u5B9A\u53EF\u4FE1\u5EA6\u7684\u6267\u884C\u5E95\u7EBF\uFF09\uFF1A
- \u628A\u77E5\u8BC6\u653E\u56DE\u5B83\u672C\u6765\u53D1\u751F\u7684\u73B0\u573A\uFF0C\u8BA9\u89C2\u4F17\u4EE5\u65C1\u89C2\u8005\u8EAB\u4EFD\u81EA\u7136\u83B7\u5F97\u4FE1\u606F
- \u8BF4\u8BDD\u8981\u7B26\u5408\u73B0\u573A\u2014\u2014\u670B\u53CB\u804A\u5929\u65F6\u7A81\u7136\u6765\u4E00\u53E5"\u5B9D\u5B9D\u4E00\u5B9A\u8981\u6536\u85CF"\uFF0C\u89C2\u4F17\u7ACB\u523B\u51FA\u620F
- \u4FDD\u7559\u6709\u4EF7\u503C\u7684\u7EA0\u9519\u3001\u8FDF\u7591\u3001\u5931\u8D25\uFF0C\u4E0D\u8981\u53EA\u5C55\u793A\u5B8C\u7F8E\u7ED3\u679C
- \u8BBE\u5907\u670D\u4ECE\u5185\u5BB9\uFF1A\u8FC7\u5F3A\u865A\u5316\u548C"\u5E7F\u544A\u7247\u611F"\u4F1A\u7834\u574F\u65C1\u89C2\u611F\uFF0C\u4E0D\u662F\u753B\u8D28\u8D8A\u9AD8\u8D8A\u597D`;
var TONE_TOUCHPOINTS = `### \u98CE\u683C\u8C03\u6027\uFF1A\u516D\u4E2A\u89E6\u70B9\u8981\u4E00\u81F4

\u5934\u50CF\u3001\u6635\u79F0\u3001\u7B80\u4ECB\u3001\u80CC\u666F\u56FE\u3001\u4E3B\u9875\u6392\u7248\u3001\u4EBA\u7269\u5F62\u8C61\u3001\u9009\u9898\u3001\u753B\u9762\u3001\u8BED\u8A00\u8154\u8C03\uFF0C
\u5E94\u5F53\u5171\u540C\u670D\u52A1\u4E00\u4E2A\u8C03\u6027\u3002**\u6B63\u5411\u5339\u914D**\u8BA9\u6240\u6709\u5143\u7D20\u7B26\u5408\u5927\u4F17\u9884\u671F\uFF1B
**\u6709\u610F\u53CD\u5DEE**\u6545\u610F\u6253\u7834\u9884\u671F\uFF08\u6BD4\u5982\u5728\u5BB6\u91CC\u7528\u751F\u6D3B\u5316\u65B9\u5F0F\u8BB2\u8D22\u7ECF\uFF0C\u964D\u4F4E\u8DDD\u79BB\u611F\uFF09\u2014\u2014
\u4F46\u53CD\u5DEE\u5FC5\u987B\u6709\u7B56\u7565\u3001\u80FD\u88AB\u7406\u89E3\uFF0C\u4E0D\u80FD\u53EA\u662F\u6DF7\u4E71\u3002

| \u89E6\u70B9 | \u8981\u56DE\u7B54\u7684\u68C0\u67E5\u95EE\u9898 |
|---|---|
| \u4E3B\u9875 | \u4E0D\u770B\u89C6\u9891\uFF0C\u80FD\u5426\u5224\u65AD\u4F60\u662F\u8C01\u3001\u7ED9\u8C01\u4EC0\u4E48\u4EF7\u503C\uFF1F |
| \u5355\u6761\u5C01\u9762 | \u8272\u5F69\u3001\u5B57\u4F53\u3001\u4FE1\u606F\u91CF\u662F\u5426\u4E0E\u6574\u4F53\u4E00\u81F4\uFF1F |
| \u4EBA\u7269 | \u670D\u88C5\u3001\u5986\u53D1\u3001\u52A8\u4F5C\u662F\u5426\u652F\u6301\u8FD9\u4E2A\u8EAB\u4EFD\uFF1F |
| \u573A\u666F | \u4E3A\u4EC0\u4E48\u5728\u8FD9\u91CC\u8BF4\u8FD9\u4EF6\u4E8B\uFF1F\u89C2\u4F17\u80FD\u5426\u4E00\u79D2\u7406\u89E3\uFF1F |
| \u8BED\u8A00 | \u53E3\u8BED/\u4E66\u9762\u8BED\u3001\u6E29\u67D4/\u66B4\u8E81\u3001\u4E13\u4E1A/\u751F\u6D3B\uFF0C\u662F\u5426\u7A33\u5B9A\uFF1F |
| \u97F3\u4E50\u526A\u8F91 | \u8282\u594F\u662F\u5728\u5F3A\u5316\u5185\u5BB9\uFF0C\u8FD8\u662F\u5728\u548C\u5185\u5BB9\u62A2\u620F\uFF1F |`;
var MEMORY_HOOKS = `### \u8BB0\u5FC6\u70B9\uFF1A\u8BA9\u7528\u6237\u80FD\u590D\u8FF0\u4F60

\u89C2\u4F17\u8BB0\u4E0D\u4F4F"\u4E13\u4E1A\u3001\u7528\u5FC3\u3001\u771F\u8BDA"\u8FD9\u7C7B\u5F62\u5BB9\u8BCD\uFF0C\u53EA\u8BB0\u5F97\u4F4F\u5177\u4F53\u7684\u3001\u53EF\u91CD\u590D\u7684\u5143\u7D20\u3002
\u4E94\u7C7B\u5165\u53E3\uFF0C\u9009 2-3 \u4E2A\u7A33\u5B9A\u4F7F\u7528\uFF1A

- **\u8BED\u8A00**\uFF1A\u6BCF\u6761\u90FD\u91CD\u590D\u7684\u53E3\u53F7\uFF0C\u6BD4\u5982"\u7C97\u66B4\u597D\u7528"\uFF0C\u540C\u65F6\u4F20\u8FBE\u5185\u5BB9\u98CE\u683C
- **\u52A8\u4F5C/\u59FF\u6001**\uFF1A\u56FA\u5B9A\u7AD9\u59FF\u3001\u624B\u52BF\u3001\u5F00\u573A\u52A8\u4F5C
- **\u9053\u5177**\uFF1A\u56FA\u5B9A\u62FF\u7740\u67D0\u4E2A\u4E1C\u897F\u2014\u2014100\u5143\u3001\u67D0\u628A\u5DE5\u5177\u3001\u67D0\u4E2A\u6807\u5FD7\u6027\u7269\u4EF6
- **\u670D\u88C5/\u8272\u5F69**\uFF1A\u7A33\u5B9A\u7684\u642D\u914D\uFF0C\u6BD4\u5982\u9ED1\u5E3D\u7EA2\u8863
- **\u573A\u666F/\u58F0\u97F3**\uFF1A\u56FA\u5B9A\u7684\u80CC\u666F\u3001\u97F3\u4E50\u6216\u97F3\u6548

\u8981\u6C42\uFF1A**\u6613\u91CD\u590D\u3001\u6613\u8BC6\u522B\u3001\u4E0E\u5B9A\u4F4D\u6709\u5173**\u3002
\u26A0\uFE0F \u91CD\u8981\u63D0\u9192\uFF1A\u5148\u751F\u4EA7\uFF0C\u518D\u89C2\u5BDF\u8BC4\u8BBA\u533A\u4E3B\u52A8\u63D0\u5230\u4E86\u54EA\u4E9B\u5143\u7D20\u2014\u2014
\u81EA\u7136\u5F62\u6210\u7684\u6807\u7B7E\uFF0C\u5F80\u5F80\u6BD4\u5F3A\u585E\u7684\u53E3\u53F7\u8010\u7528\u5F97\u591A\u3002\u6240\u4EE5\u8BB0\u5FC6\u70B9\u8981\u7ED9\u5EFA\u8BAE\uFF0C
\u4F46\u8981\u6807\u660E"\u5F85\u9A8C\u8BC1"\uFF0C\u4E0D\u8981\u5199\u6210\u5FC5\u987B\u7167\u505A\u3002`;
var DIFFERENTIATION = `### \u5DEE\u5F02\u5316\uFF1A\u4E0D\u662F\u4ECE\u96F6\u53D1\u660E\uFF0C\u662F\u5728\u6210\u719F\u6A21\u5F0F\u4E0A\u505A\u53EF\u8BC6\u522B\u7684\u53D8\u5316

\u5DEE\u5F02\u5316\u7684\u6B63\u786E\u505A\u6CD5\u662F**\u628A\u884C\u4E1A\u5E38\u89C4\u5185\u5BB9 + \u4E00\u4E2A\u65B0\u5143\u7D20**\uFF0C\u505A\u5FAE\u521B\u65B0\u3002
\u4E0B\u9762 24 \u4E2A\u5143\u7D20\u53EF\u53E0\u52A0\u4F7F\u7528\uFF1A

| \u7C7B\u522B | 6 \u4E2A\u53EF\u53E0\u52A0\u5143\u7D20 | \u6539\u53D8\u7684\u662F\u4EC0\u4E48 |
|---|---|---|
| \u4EBA\u7269 | \u8EAB\u4EFD\u4E92\u6362\u3001\u8EAB\u4EFD\u53CD\u5DEE\u3001\u4EBA\u7269\u5173\u7CFB\u3001\u4E00\u4EBA\u591A\u89D2\u3001\u89D2\u8272\u626E\u6F14\u3001\u626E\u732A\u5403\u864E | \u8C01\u5728\u505A\u3001\u8C01\u4E0E\u8C01\u4E92\u52A8 |
| \u60C5\u5883 | \u60C5\u5883\u8FD8\u539F\u3001\u6362\u89C6\u89D2\u3001\u6362\u573A\u666F\u3001\u8857\u5934\u91C7\u8BBF\u3001\u5357\u5317\u5DEE\u5F02\u3001\u6000\u65E7\u590D\u53E4 | \u5728\u54EA\u91CC\u3001\u4ECE\u54EA\u4E2A\u89D2\u5EA6\u770B |
| \u884C\u4E3A | \u53CD\u5411\u64CD\u4F5C\u3001\u6B63\u786EVS\u9519\u8BEF\u3001\u5BF9\u6BD4\u6539\u9020\u3001\u63A5\u53D7\u6311\u6218\u3001\u6C42\u52A9\u7F51\u53CB\u3001\u66FF\u7F51\u53CB\u505A | \u52A8\u4F5C\u987A\u5E8F\u4E0E\u53C2\u4E0E\u5173\u7CFB |
| \u8868\u8FBE | \u8DE8\u754C\u786C\u7EC4\u5408\u3001\u8F6F\u7EC4\u5408\u3001Rap+\u3001\u6A21\u4EFF\u7535\u5F71\u3001\u501F\u7269\u55BB\u4EBA\u3001\u4E00\u53E5\u8BDD\u6545\u4E8B | \u7528\u4EC0\u4E48\u8BED\u8A00\u548C\u7ED3\u6784\u8868\u8FBE |

**\u64CD\u4F5C\u6B65\u9AA4**\uFF1A
1. \u627E\u51FA\u540C\u884C\u6700\u5E38\u89C1\u7684\u9009\u9898\u548C\u5F62\u5F0F\uFF0C\u5199\u6210"\u5E38\u89C4A"
2. \u4ECE 24 \u5143\u7D20\u91CC\u9009\u4E00\u4E2A\uFF0C\u5F62\u6210"A + \u53D8\u91CFB"
3. \u68C0\u67E5 B \u662F\u5426\u670D\u52A1\u76EE\u6807\u7528\u6237\uFF0C**\u800C\u4E0D\u662F\u53EA\u8BA9\u521B\u4F5C\u8005\u81EA\u55E8**
4. \u8BBE\u8BA1\u6700\u4F4E\u6210\u672C\u7684\u6837\u7247\uFF0C\u8FDE\u7EED\u6D4B\u8BD5 3-5 \u6761
5. \u6709\u6548\u5C31\u4FDD\u7559\u53D8\u91CF\uFF0C\u518D\u4F18\u5316\u5F00\u7BC7\u3001\u8282\u594F\u548C\u955C\u5934\uFF1B\u65E0\u6548\u5C31\u6362\u53D8\u91CF\uFF0C**\u4E0D\u8981\u6025\u7740\u5426\u5B9A\u6574\u4E2A\u8D5B\u9053**`;
var CONTENT_DIRECTION = `### \u5148\u5B9A\u5185\u5BB9\u65B9\u5411\uFF1A\u591A\u5143\u56DB\u7C7B\uFF0C\u8FD8\u662F\u5355\u4E00\u4E3B\u9898

\u5185\u5BB9\u5B9A\u4F4D\u7684\u7B2C\u4E00\u4E2A\u51B3\u5B9A\uFF08\u5C0F\u9EC4\u7B2C8\u300116\u300139\u8282\uFF09\uFF0C\u4E24\u6761\u8DEF\uFF1A

| \u65B9\u5411 | \u505A\u6CD5 | \u9002\u5408\u8C01 | \u4EE3\u4EF7 |
|---|---|---|---|
| **A \u591A\u5143\u56DB\u7C7B** | \u77E5\u8BC6 / \u6545\u4E8B / \u6652\u8FC7\u7A0B / \u89C2\u70B9\u56DB\u7C7B\u90FD\u53D1\uFF0C\u4ECE\u591A\u4E2A\u89D2\u5EA6\u7ACB\u4F4F\u8FD9\u4E2A\u4EBA | \u7B56\u5212\u80FD\u529B\u4E00\u822C\u3001\u521A\u5F00\u59CB\u6478\u7D22\u7684 | \u6807\u7B7E\u4E0D\u591F\u9C9C\u660E\uFF0C\u9700\u8981\u9760\u8BB0\u5FC6\u70B9\u548C\u7CFB\u5217\u8865 |
| **B \u5355\u4E00\u4E3B\u9898** | \u6574\u4E2A\u53F7\u56F4\u7ED5\u4E00\u4E2A\u53EF\u6301\u7EED\u7684\u4EFB\u52A1\u53CD\u590D\u62CD\uFF1A\u4F53\u9A8C100\u79CD\u804C\u4E1A\u3001\u63A5\u53D7\u7C89\u4E1D\u6311\u6218\u63A2\u5E97\u3001\u4EE5\u7269\u6362\u7269\u3001\u63A2\u8BBF30\u5E74\u8001\u5E97 | \u7B56\u5212\u548C\u6267\u884C\u80FD\u529B\u5F3A\u3001\u6709\u771F\u5B9E\u7D20\u6750\u6E90\u6E90\u4E0D\u65AD\u7684 | \u7B56\u5212\u96BE\u3001\u6267\u884C\u96BE\uFF1B\u4F46\u4E00\u65E6\u8DD1\u901A\uFF0C**\u6DA8\u7C89\u5FEB\u3001\u7C98\u6027\u5F3A\u3001\u6613\u5F62\u6210\u54C1\u724C\u3001\u53D8\u73B0\u5F3A** |

\u5224\u65AD\u770B\u4E09\u4EF6\u4E8B\uFF1A\u4ED6**\u624B\u4E0A\u6709\u6CA1\u6709\u80FD\u53CD\u590D\u53D1\u751F\u7684\u771F\u5B9E\u4E8B\u4EF6**\uFF08\u5929\u5929\u5728\u505A\u7684\u5DE5\u4F5C\u3001\u56FA\u5B9A\u4F1A\u9047\u5230\u7684\u4EBA\uFF09\u3001
**\u4E00\u4E2A\u4EBA\u80FD\u4E0D\u80FD\u7A33\u5B9A\u6267\u884C**\u3001**\u8FD9\u4E2A\u4E3B\u9898\u548C\u4ED6\u8981\u5356\u7684\u4E1C\u897F\u8FDE\u4E0D\u8FDE\u5F97\u4E0A**\u3002
\u4E5F\u53EF\u4EE5 **A \u6253\u5E95 + \u4E00\u4E2A B \u5F53\u738B\u724C\u680F\u76EE**\u2014\u2014\u4F46\u8981\u8BF4\u6E05\u695A\u54EA\u4E2A\u662F\u4E3B\uFF0C\u4E0D\u8981\u4E24\u5934\u90FD\u60F3\u8981\u3001\u4E24\u5934\u90FD\u6CA1\u505A\u900F\u3002

\u26A0\uFE0F \u4E0D\u7BA1\u9009\u54EA\u6761\uFF0C\u90FD\u8981\u8BF4\u51FA**\u4E3A\u4EC0\u4E48\u4E0D\u9009\u53E6\u4E00\u6761**\u3002`;
var SERIES_DESIGN = `### \u7CFB\u5217\u600E\u4E48\u8BBE\u8BA1\uFF1A\u5148\u8FC7"\u80FD\u4E0D\u80FD\u7ACB\u9879"\uFF0C\u518D\u5B9A"\u600E\u4E48\u4E00\u96C6\u96C6\u51FA"

**\u2460 \u7ED3\u6784\uFF1A\u5B9A\u91CF + \u53D8\u91CF**\uFF08\u859B\u8001\u5E08\uFF09
- **\u5B9A\u91CF**\uFF1A\u6BCF\u96C6\u90FD\u4E0D\u53D8\u7684\u6838\u5FC3\u2014\u2014\u540C\u4E00\u4E2A\u4EFB\u52A1\u3001\u540C\u4E00\u4E2A\u7ED3\u6784\u3001\u540C\u4E00\u53E5\u5F00\u573A
- **\u53D8\u91CF**\uFF1A\u6BCF\u96C6\u6362\u6389\u7684\u4E1C\u897F\u2014\u2014\u4EBA\u7269\u3001\u5730\u70B9\u3001\u884C\u4E1A\u3001\u96BE\u5EA6\u3001\u7ED3\u679C
- \u4F8B\uFF1A\u300C\u6D4B\u8BC450\u4E2A\u660E\u661F\u7684\u51CF\u80A5\u65B9\u6CD5\u300D\u5B9A\u91CF\u662F\u51CF\u8102\u9910\u3001\u53D8\u91CF\u662F\u660E\u661F\uFF1B
  \u300C100\u4E2A\u8001\u7834\u5C0F\u6539\u9020\u300D\u5B9A\u91CF\u662F\u56DE\u8FC1\u623F\u6539\u9020\u3001\u53D8\u91CF\u662F\u6237\u578B
- \u8BF4\u4E0D\u51FA\u5B9A\u91CF\u548C\u53D8\u91CF\u7684\uFF0C\u5C31\u53EA\u662F\u4E00\u4E2A\u8BDD\u9898\uFF0C\u4E0D\u662F\u7CFB\u5217

**\u2461 \u7ACB\u9879\u68C0\u9A8C**\uFF08\u5C0F\u9EC4\uFF09\u2014\u2014\u56DB\u6761\u5168\u8FC7\u624D\u7B97\u4E00\u4E2A\u7CFB\u5217\uFF1A
- **\u4E00\u53E5\u8BDD\u8BB2\u6E05**\uFF0C\u800C\u4E14\u8BA9\u4EBA\u81EA\u7136\u60F3\u77E5\u9053\u4E0B\u4E00\u96C6
- **\u6491\u5F97\u4F4F 30 \u96C6**\uFF1A\u5148\u5217\u51FA\u524D 10 \u96C6\u7684\u5177\u4F53\u6807\u9898\uFF0C\u5217\u4E0D\u6EE1 10 \u96C6\u7684\u76F4\u63A5\u653E\u5F03
- **\u771F\u5B9E\u6027\u4F18\u5148**\uFF1A\u771F\u5B9E\u8BB0\u5F55\u3001\u660E\u786E\u6F14\u7ECE\u90FD\u53EF\u4EE5\uFF0C**\u6700\u4F24\u4FE1\u4EFB\u7684\u662F\u5047\u88C5\u968F\u673A\u5374\u88AB\u8BC6\u7834**
- **\u548C\u53D8\u73B0\u81EA\u7136\u8FDE\u4E0A**\uFF1A\u770B\u8FD9\u4E2A\u7CFB\u5217\u7684\u4EBA\uFF0C\u5C31\u662F\u4F1A\u4E70\u4ED6\u4E1C\u897F\u7684\u4EBA\uFF08\u6216\u8005\u4F1A\u7ED9\u4ED6\u80CC\u4E66\u7684\u4EBA\uFF09

**\u2462 \u52A0\u6599**\uFF1A\u6BCF\u96C6\u6807\u9898\u53EF\u4EE5\u53E0\u4E00\u4E2A\u7206\u6B3E\u5143\u7D20\uFF08\u859B\u8001\u5E08\u516B\u5927\u5143\u7D20\uFF1A\u6210\u672C\u3001\u4EBA\u7FA4\u3001\u5934\u724C\u3001\u5947\u8469\u3001
\u6700\u5DEE\u3001\u53CD\u5DEE\u3001\u6000\u65E7\u3001\u8377\u5C14\u8499\uFF09\uFF0C\u8BA9\u540C\u4E00\u4E2A\u7CFB\u5217\u91CC\u6BCF\u96C6\u90FD\u6709\u65B0\u7684\u70B9\u51FB\u7406\u7531\u3002

**\u2463 36 \u8BA1\u4E5F\u80FD\u505A\u6210\u7CFB\u5217**\uFF08\u5C0F\u9EC4\uFF09\uFF1A\u628A\u4E00\u8BA1\u7684\u7ED3\u6784\u516C\u5F0F\u5F53**\u5B9A\u91CF**\uFF0C\u6BCF\u96C6\u6362\u5BF9\u8C61\u3001\u573A\u666F\u5F53**\u53D8\u91CF**\u2014\u2014
\u300C\u6B63\u786E\u505A\u6CD5VS\u9519\u8BEF\u505A\u6CD5\u300D\u505A\u6210\u300A\u88C5\u4FEE\u91CC\u7684 X \u4E2A\u9519\u8BEF\u505A\u6CD5\u300B\uFF0C\u300C\u8857\u5934\u91C7\u8BBF\u300D\u505A\u6210\u300A\u95EE X \u4E2A\u8001\u677F\u540C\u4E00\u4E2A\u95EE\u9898\u300B\u3002
\u8FD9\u79CD\u7CFB\u5217**\u6700\u597D\u843D\u5730**\uFF1A\u516C\u5F0F\u662F\u73B0\u6210\u7684\uFF0C\u4E0D\u9760\u6BCF\u96C6\u91CD\u65B0\u60F3\u70B9\u5B50\uFF0C\u9002\u5408\u53E3\u64AD\u5F31\u3001\u7075\u611F\u5C11\u7684\u53F7\u3002`;
var TOPIC_SOURCES = `### \u9009\u9898\u4ECE\u54EA\u6765\uFF08\u5C0F\u9EC4\u7B2C19\u8282\uFF09

**\u56DB\u5927\u65B9\u5411**\uFF0C\u6BCF\u4E2A\u53F7\u90FD\u80FD\u4ECE\u8FD9\u56DB\u5904\u6316\uFF1A
1. **\u77E5\u8BC6\u50A8\u5907**\uFF1A\u884C\u4E1A\u91CC\u7684\u95E8\u9053\u3001\u5916\u884C\u600E\u4E48\u907F\u5751\u3001\u5E72\u8D27
2. **\u7ECF\u5386\u4E0E\u6545\u4E8B**\uFF1A\u81EA\u5DF1\u7684\u3001\u5458\u5DE5\u7684\u3001\u5BA2\u6237\u7684\u3001\u548C\u8FD9\u884C\u6709\u5173\u7684\u6545\u4E8B
3. **\u70ED\u95E8\u8BDD\u9898\u4E0E\u89C2\u70B9**\uFF1A\u540C\u884C\u9AD8\u8D5E\u9009\u9898\u3001\u70ED\u70B9\u4E8B\u4EF6\uFF0C\u7ED9\u51FA\u81EA\u5DF1\u7684\u770B\u6CD5
4. **\u5B9E\u64CD\u8BB0\u5F55**\uFF1A\u6B63\u5728\u505A\u7684\u4E8B\u3001\u505A\u7684\u8FC7\u7A0B

**\u4E5D\u5BAB\u683C\uFF08\u8FDB\u9636\uFF09**\uFF1A\u4E00\u8FB9\u653E\u884C\u4E1A\u5173\u952E\u8BCD\uFF0C\u4E00\u8FB9\u653E\u76EE\u6807\u4EBA\u7FA4\u611F\u5174\u8DA3\u7684\u5173\u952E\u8BCD\uFF08\u60F3\u6323\u94B1\u3001\u60F3\u7701\u5FC3\u3001\u6015\u88AB\u5751\u2026\uFF09\uFF0C
\u4E24\u4E24\u8FDE\u8D77\u6765\u5C31\u662F\u4E00\u4E2A\u9009\u9898\uFF1B\u6362\u5173\u952E\u8BCD\u5C31\u80FD\u4E0D\u65AD\u751F\u6210\uFF0C\u9002\u5408\u540C\u884C\u9009\u9898\u88AB\u6316\u7A7A\u4E4B\u540E\u7528\u3002`;
var ECONOMY_MODELS = `### \u5148\u5206\u6E05\u5728\u73A9\u54EA\u79CD\u7ECF\u6D4E

| \u6A21\u5F0F | \u505A\u6CD5 | \u7ED3\u679C | \u9002\u5408\u8C01 |
|---|---|---|---|
| \u6D41\u91CF\u7ECF\u6D4E | \u4E0D\u9732\u8138\u3001\u4E0D\u505AIP\u3001\u9760\u6295\u6D41 | \u9000\u8D27\u7387\u9AD8\u3001\u5BB9\u6613\u4E8F | \u6709\u8D44\u91D1\u6709\u4F9B\u5E94\u94FE\u7684\u56E2\u961F |
| \u7C89\u4E1D\u7ECF\u6D4E | \u6253\u9020\u4E2A\u4EBAIP\uFF0C\u9760\u4FE1\u4EFB\u6210\u4EA4 | \u5229\u6DA6\u9AD8\u3001\u9000\u8D27\u7387\u4F4E | **\u4E2A\u4EBA\u548C\u4E2D\u5C0F\u5546\u5BB6** |
| \u54C1\u724C\u7ECF\u6D4E | \u5F00\u5C4F\u5E7F\u544A\u3001\u70ED\u641C\u3001\u660E\u661F | \u9884\u7B97\u901A\u5E38\u4EBF\u5143\u7EA7 | \u5927\u4F01\u4E1A |

**\u4EA7\u54C1\u662F\u4E3A\u4E86\u6EE1\u8DB3\u9700\u6C42\uFF0C\u4EBA\u7269\u662F\u4E3A\u4E86\u5236\u9020\u504F\u597D\u3002**
\u4E1C\u897F\u5356\u4E0D\u52A8\uFF0C\u5F88\u591A\u65F6\u5019\u4E0D\u662F\u4EA7\u54C1\u4E0D\u884C\uFF0C\u662F\u987E\u5BA2\u8FD8\u4E0D\u559C\u6B22\u4F60\u3002
\u975E\u6807\u54C1\uFF08\u7406\u53D1\u3001\u6444\u5F71\u3001\u6559\u80B2\u3001\u9910\u996E\u670D\u52A1\uFF09\u5C24\u5176\u4F9D\u8D56\u4EBA\u7269\u2014\u2014
\u89C2\u4F17\u613F\u610F\u4E3A\u4FE1\u4EFB\u7684\u4EBA\u4ED8\u66F4\u9AD8\u7684\u4EF7\u3002

### \u53D8\u73B0\u65B9\u5F0F\u600E\u4E48\u6392\uFF08\u859B\u8001\u5E08\uFF09

| \u65B9\u5F0F | \u6536\u5165\u91CF\u7EA7 | \u666E\u901A\u4EBA\u505A\u6210\u7684\u96BE\u5EA6 | \u5EFA\u8BAE |
|---|---|---|---|
| \u5F15\u6D41\uFF08\u5230\u5E97\u3001\u79C1\u4FE1\u3001\u52A0\u5FAE\u4FE1\u6210\u4EA4\uFF09 | \u9AD8 | \u4F4E | **\u4F18\u5148** |
| \u5356\u8D27\uFF08\u5E26\u81EA\u5DF1\u7684\u6216\u522B\u4EBA\u7684\u8D27\uFF09 | \u9AD8 | \u4F4E | **\u4F18\u5148** |
| \u5E7F\u544A | \u9AD8 | \u6781\u9AD8\uFF0C\u4E00\u822C\u8981\u51E0\u5341\u4E07\u5230\u4E0A\u767E\u4E07\u7C89 | \u5F53\u8FDC\u671F\u5F69\u86CB\uFF0C\u4E0D\u80FD\u5F53\u8D77\u53F7\u671F\u7684\u4E3B\u8981\u6536\u5165 |
| \u6253\u8D4F | \u4E0D\u7A33\u5B9A | \u6781\u9AD8 | \u4E0D\u5EFA\u8BAE\u666E\u901A\u4EBA\u6307\u671B |

\u6863\u6848\u91CC\u540C\u65F6\u52FE\u4E86\u597D\u51E0\u79CD\u53D8\u73B0\u65B9\u5F0F\u7684\uFF0C**\u8981\u6392\u51FA\u5148\u540E**\uFF1A\u5148\u9760\u5F15\u6D41\u548C\u5356\u8D27\u6D3B\u4E0B\u6765\uFF0C
\u5E7F\u544A\u548C\u6253\u8D4F\u7B49\u7C89\u4E1D\u91CF\u771F\u7684\u4E0A\u6765\u4E86\u518D\u8BF4\u3002\u5B9A\u4F4D\u4E5F\u662F**\u5C0F\u800C\u4E13\u6BD4\u5927\u800C\u5168\u597D\u505A**\u2014\u2014
\u5148\u5728\u4E00\u4E2A\u7A84\u7684\u70B9\u4E0A\u505A\u900F\uFF0C\u518D\u5F80\u5916\u6269\u3002`;
var DIAGNOSIS_TREE = `### \u6570\u636E\u8BCA\u65AD\u6811\uFF1A\u8DD1\u4E0D\u901A\u65F6\u5148\u67E5\u54EA\u91CC

\u5B9A\u4F4D\u65B9\u6848\u5FC5\u987B\u81EA\u5E26"\u4E0D\u7075\u600E\u4E48\u529E"\uFF0C\u5426\u5219\u7528\u6237\u53D1\u4E86\u5341\u6761\u6CA1\u6C34\u82B1\u5C31\u653E\u5F03\u4E86\u3002

| \u73B0\u8C61 | \u4F18\u5148\u6000\u7591 | \u4E0B\u4E00\u6B21\u5B9E\u9A8C |
|---|---|---|
| \u66DD\u5149\u5C11 | \u9009\u9898\u592A\u7A84\u3001\u8D26\u53F7\u6807\u7B7E\u4E0D\u6E05\u3001\u8FDD\u89C4\u6216\u4F4E\u8D28 | \u6362\u66F4\u5E7F\u7684\u5165\u53E3\uFF1B\u67E5\u5408\u89C4\uFF1B\u8FDE\u53D1\u540C\u4E3B\u9898 |
| \u6709\u66DD\u5149\u4F46\u524D\u6BB5\u6D41\u5931 | \u9996\u5E27\u3001\u7B2C\u4E00\u53E5\u3001\u627F\u8BFA\u4E0D\u6E05 | \u91CD\u5199 5 \u4E2A\u5F00\u7BC7\uFF1B\u7ED3\u679C\u6216\u51B2\u7A81\u524D\u7F6E |
| \u524D\u6BB5\u597D\u4F46\u5B8C\u64AD\u5DEE | \u8282\u594F\u6162\u3001\u94A9\u5B50\u6CA1\u63A5\u4F4F\u3001\u4FE1\u606F\u91CD\u590D | \u5220\u6389 30%\uFF1B\u52A0\u8F6C\u6298\uFF1B\u63D0\u524D\u5151\u73B0 |
| \u70B9\u8D5E\u9AD8\u6536\u85CF\u4F4E | \u60C5\u7EEA\u5F3A\u4F46\u5B9E\u7528\u6027\u5F31 | \u52A0\u6B65\u9AA4\u3001\u6E05\u5355\u3001\u53EF\u6267\u884C\u7684\u603B\u7ED3 |
| \u64AD\u653E\u9AD8\u5173\u6CE8\u4F4E | \u4EBA\u8BBE\u5F31\u3001\u6CA1\u6709\u7CFB\u5217\u627F\u8BFA | \u56FA\u5B9A\u680F\u76EE\uFF1B\u5F3A\u5316\u8EAB\u4EFD\u4E0E\u4E0B\u96C6\u671F\u5F85 |
| \u7C89\u4E1D\u591A\u54A8\u8BE2\u5C11 | \u4E13\u4E1A\u8BC1\u636E\u4E0D\u8DB3\u3001\u4EA7\u54C1\u5173\u8054\u5F31\u3001\u4E3B\u9875\u627F\u63A5\u5DEE | \u8865\u6848\u4F8B\u548C\u8FC7\u7A0B\uFF1B\u7406\u6E05\u4E3B\u9875\u548C\u884C\u52A8\u5165\u53E3 |
| \u54A8\u8BE2\u591A\u6210\u4EA4\u5C11 | \u4EBA\u7FA4\u4E0D\u51C6\u3001\u4EA7\u54C1\u4E0D\u5339\u914D\u3001\u4FE1\u4EFB\u4E0D\u591F | \u91CD\u5BA1\u7528\u6237\u548C\u53D8\u73B0\u5B9A\u4F4D\uFF1B\u8BBF\u8C08\u6CA1\u6210\u4EA4\u7684\u4EBA |`;
var CONTENT_MIX = `### \u5185\u5BB9\u914D\u6BD4\uFF1A\u6309\u4E0B\u9762\u4E94\u6B65\u63A8\uFF0C\u4E0D\u8981\u51ED\u611F\u89C9\u7ED9\u6570

**\u5148\u5206\u6E05\u4E24\u5C42\uFF0C\u5B83\u4EEC\u4E0D\u662F\u4E00\u56DE\u4E8B**\uFF1A
- **\u4F5C\u7528**\uFF08\u9009\u9898\u4E09\u5927\u539F\u5219\uFF09\uFF1A\u8FD9\u6761\u5185\u5BB9\u66FF\u8D26\u53F7\u5E72\u4EC0\u4E48\u6D3B\u2014\u2014
  **\u6D41\u91CF\u578B**\u8BA9\u66F4\u591A\u65B0\u4EBA\u5237\u5230\uFF1B**\u4EBA\u8BBE\u578B**\u8BA9\u4EBA\u8BB0\u4F4F\u4F60\u3001\u4FE1\u4F60\u8FD9\u4E2A\u4EBA\uFF1B**\u53D8\u73B0\u578B**\u63A8\u52A8\u54A8\u8BE2\u548C\u6210\u4EA4
- **\u5F62\u5F0F**\uFF1A\u7528\u4EC0\u4E48\u8BB2\u2014\u2014\u77E5\u8BC6 / \u6545\u4E8B / \u6652\u8FC7\u7A0B / \u89C2\u70B9 / \u6BB5\u5B50

\u914D\u6BD4\u5FC5\u987B**\u4E09\u5C42\u90FD\u7ED9**\uFF1A\u5148\u5B9A\u4F5C\u7528\u5360\u6BD4\uFF0C\u518D\u8BF4\u6BCF\u79CD\u4F5C\u7528\u7528\u4EC0\u4E48\u5F62\u5F0F\u6765\u505A\uFF0C\u6700\u540E\u662F\u9898\u6750\uFF08\u7B2C\u4E94\u6B65\uFF09\u3002

| \u5F62\u5F0F | \u6700\u64C5\u957F\u5E72\u7684\u6D3B | \u8981\u8BC1\u660E\u4EC0\u4E48 | \u5E38\u89C1\u98CE\u9669 |
|---|---|---|---|
| \u77E5\u8BC6\u578B | \u53D8\u73B0\uFF08\u4E13\u4E1A\u4FE1\u4EFB\uFF09\uFF1B\u53EA\u6709**\u6CDB\u77E5\u8BC6\u3001\u957F\u89C1\u8BC6**\u7684\u89D2\u5EA6\u624D\u80FD\u505A\u6D41\u91CF | \u6211\u77E5\u9053\u3001\u80FD\u8BB2\u6E05 | **\u884C\u4E1A\u5E72\u8D27\u53D7\u4F17\u7A84\u3001\u6D41\u91CF\u4E0A\u9650\u4F4E**\uFF1B\u8BF4\u6559\uFF1B\u7F3A\u8BC1\u636E |
| \u6545\u4E8B\u578B | \u4EBA\u8BBE\uFF08\u6DF1\u5EA6\u4FE1\u4EFB\uFF09\uFF1B\u771F\u5B9E\u7ECF\u5386\u4E5F\u5E38\u62FF\u5927\u6D41\u91CF | \u6211\u7ECF\u5386\u8FC7\u3001\u4EF7\u503C\u89C2\u4E00\u81F4 | \u7F16\u9020\u3001\u717D\u60C5\u8FC7\u5EA6\u3001\u8282\u594F\u6162 |
| \u6652\u8FC7\u7A0B\u578B | \u53D8\u73B0\uFF08\u771F\u5B9E\u4E0E\u80FD\u529B\u8BC1\u660E\uFF09\uFF1B**\u8D77\u53F7\u5FEB\u3001\u6DA8\u7C89\u5FEB** | \u6211\u6B63\u5728\u505A\u3001\u80FD\u505A\u6210 | \u524D5\u79D2\u65E0\u671F\u5F85\u3001\u6D41\u6C34\u8D26 |
| \u89C2\u70B9\u578B | \u6D41\u91CF\uFF08\u5171\u9E23\u4E0E\u8BA8\u8BBA\uFF09 | \u6211\u61C2\u4F60\u3001\u6562\u8868\u8FBE | \u8FCE\u5408\u3001\u6781\u5316\u3001\u53EA\u6709\u6001\u5EA6\u65E0\u8BBA\u636E |
| \u6BB5\u5B50\u578B | \u6D41\u91CF\uFF08\u5A31\u4E50\u4E0E\u4F20\u64AD\uFF09 | \u6211\u6709\u8DA3\u3001\u53EF\u8BB0\u5FC6 | \u5236\u4F5C\u6210\u672C\u9AD8\u3001\u7C89\u4E1D\u4E0D\u7CBE\u51C6 |

\u26A0\uFE0F **\u9009\u9898\u51B3\u5B9A\u6D41\u91CF\u4E0A\u9650**\uFF1A\u8BB2\u7ED9\u884C\u5185\u4EBA\u542C\u7684\u5E72\u8D27\uFF08\u600E\u4E48\u6311\u5496\u5561\u8C46\u3001\u600E\u4E48\u5199\u5F00\u7BC7\u7B2C\u4E00\u53E5\uFF09\u53D7\u4F17\u7A84\uFF0C
\u6D41\u91CF\u5929\u82B1\u677F\u4F4E\uFF1B\u8986\u76D6\u4EBA\u7FA4\u8D8A\u5E7F\u2014\u2014\u957F\u89C1\u8BC6\u3001\u89C2\u70B9\u3001\u6545\u4E8B\u3001\u5E26\u516B\u5366\u5C5E\u6027\u7684\u8BDD\u9898\u2014\u2014\u4E0A\u9650\u8D8A\u9AD8\u3002
**\u60F3\u8981\u5927\u6D41\u91CF\uFF0C\u5C31\u4E0D\u80FD\u8BA9\u884C\u4E1A\u5E72\u8D27\u5F53\u4E3B\u529B\u3002**

---

**\u7B2C\u4E00\u6B65\uFF1A\u770B\u8D26\u53F7\u9636\u6BB5\uFF0C\u5B9A\u4F5C\u7528\u914D\u6BD4**

- **\u65B0\u53F7 / \u521A\u8D77\u53F7**\uFF080 \u5230 1000 \u7C89\u3001\u6D41\u91CF\u8FD8\u4E0D\u7A33\u5B9A\uFF09\uFF1A\u8FD9\u4E00\u9636\u6BB5\u53EA\u6709\u4E00\u4E2A\u4EFB\u52A1\u2014\u2014\u62FF\u5230\u7A33\u5B9A\u7684\u6D41\u91CF\u548C\u6B63\u53CD\u9988\u3002
  \u8D77\u53F7\u6253\u6CD5\u5927\u591A\u662F\u6D41\u91CF\u578B\u5185\u5BB9\uFF0C\u96F6\u7C89\u505A\u5230\u4E00\u5343\u7C89\u4E14\u6D41\u91CF\u7A33\u5B9A\u624D\u7B97\u8D77\u53F7\u6210\u529F\uFF0C\u4E4B\u540E\u518D\u8865\u89C2\u70B9\u3001\u6545\u4E8B\u7B49\u5185\u5BB9\u3002
  \u6240\u4EE5**\u6D41\u91CF\u578B\u5FC5\u987B\u662F\u6700\u5927\u7684\u4E00\u5757**\uFF1B\u53D8\u73B0\u578B\u4ECE\u7B2C\u4E00\u5468\u5C31\u8981\u6709\uFF0C\u4F46\u53EA\u5360\u5C0F\u5934\uFF0C\u522B\u8BA9\u53F7\u4E00\u5F00\u59CB\u5C31\u50CF\u5E7F\u544A\u53F7\u3002
- **\u8D77\u53F7\u540E\u5230\u6210\u719F\u524D**\uFF08\u6D41\u91CF\u5DF2\u7A33\u5B9A\uFF09\uFF1A\u5B9E\u4F53\u5E97 / \u670D\u52A1\u5546\u6309 **\u53D8\u73B050% / \u4EBA\u8BBE20% / \u6D41\u91CF30%**\uFF0C
  \u4E09\u7C7B\u6BCF\u5468\u90FD\u8981\u6709\uFF0C\u4E0D\u80FD\u53EA\u53D1\u4E00\u79CD\uFF08\u4EE3\u8FD0\u8425SOP\uFF1BSOP \u4E5F\u5199\u660E\u65B0\u53F7\u524D\u671F\u53EF\u9002\u5F53\u63D0\u9AD8\u6D41\u91CF\u578B\u6BD4\u4F8B\uFF09\u3002
- **\u6210\u719F\u8D26\u53F7**\uFF1A\u5F62\u5F0F\u4E0A\u53EF\u53C2\u8003 **\u77E5\u8BC640% / \u6545\u4E8B20% / \u8FC7\u7A0B20% / \u89C2\u70B920%**\uFF0C\u6BB5\u5B50\u6309\u80FD\u529B\u9009\u914D\u3002
  \u26A0\uFE0F **\u8FD9\u662F\u6210\u719F\u8D26\u53F7\u7684\u57FA\u51C6\uFF0C\u4E0D\u662F\u65B0\u53F7\u7684**\u3002\u521A\u8D77\u53F7\u76F4\u63A5\u5957\u5B83\uFF0C\u6559\u77E5\u8BC6\u6392\u7B2C\u4E00\uFF0C\u6D41\u91CF\u5C31\u505A\u6B7B\u4E86\u3002

**\u7B2C\u4E8C\u6B65\uFF1A\u770B\u7528\u6237\u7684\u76EE\u6807\uFF0C\u8C03\u6574\u4F5C\u7528\u914D\u6BD4**

\u7528\u6237\u8865\u5145\u8BF4\u660E\u91CC\u5199\u7684\u76EE\u6807**\u4F18\u5148\u4E8E\u4E0A\u9762\u7684\u9ED8\u8BA4\u503C**\uFF1A
- \u5199\u4E86\u8981**\u5927\u6D41\u91CF\u3001\u6709\u5F71\u54CD\u529B\u3001\u6DA8\u7C89\u3001\u505A\u535A\u4E3B** \u2192 \u6D41\u91CF\u578B\u5F80\u4E0A\u52A0\uFF0C\u4E3B\u529B\u5F62\u5F0F\u6362\u6210\u8986\u76D6\u4EBA\u7FA4\u5E7F\u7684
  \uFF08\u89C2\u70B9\u3001\u6545\u4E8B\u3001\u6652\u8FC7\u7A0B\u3001\u6CDB\u77E5\u8BC6\uFF09\uFF0C\u884C\u4E1A\u5E72\u8D27\u9000\u5230\u8F85\u52A9\u4F4D
- \u5199\u4E86**\u53EA\u8981\u7CBE\u51C6\u5BA2\u6237\u3001\u4E0D\u5728\u4E4E\u64AD\u653E** \u2192 \u53D8\u73B0\u578B\u5F80\u4E0A\u52A0\uFF0C\u6D41\u91CF\u578B\u53EA\u4FDD\u7559\u6269\u66DD\u5149\u7684\u6700\u4F4E\u91CF
- \u4E24\u4E2A\u90FD\u8981\uFF08\u65E2\u8981\u6D41\u91CF\u53C8\u8981\u53D8\u73B0\uFF09\u2192 **\u9636\u6BB5\u51B3\u5B9A\u5148\u540E**\uFF1A\u8D77\u53F7\u671F\u6D41\u91CF\u4F18\u5148\uFF0C\u53D8\u73B0\u578B\u4ECE\u5C0F\u5934\u6162\u6162\u957F\u4E0A\u6765\uFF0C
  \u5E76\u5199\u6E05\u695A\u4EC0\u4E48\u6570\u636E\u51FA\u73B0\u65F6\u5207\u6362\u914D\u6BD4

**\u7B2C\u4E09\u6B65\uFF1A\u770B\u6570\u636E\uFF0C\u5B9A\u4E3B\u529B\u5F62\u5F0F**

\u6863\u6848\u91CC\u300C\u6570\u636E\u6700\u597D\u7684\u5185\u5BB9\u7C7B\u578B\u300D\u662F\u8FD9\u4E2A\u4EBA**\u5DF2\u7ECF\u88AB\u9A8C\u8BC1\u8FC7**\u7684\u4E1C\u897F\uFF0C**\u5B83\u5C31\u662F\u4E3B\u529B\u5F62\u5F0F**\u3002
\u65B0\u53F7\u8D77\u6B65\u5148\u628A\u8FD9\u4E00\u79CD\u96C6\u4E2D\u8DD1\u901A 20-30 \u6761\uFF0C\u518D\u9010\u6B65\u8865\u5176\u4ED6\u7C7B\u578B\u2014\u2014"\u5355\u4E00\u7C7B\u578B\u8D77\u53F7"\u662F\u9636\u6BB5\u7B56\u7565\uFF0C
\u4E0D\u662F\u6C38\u8FDC\u53EA\u53D1\u4E00\u79CD\u3002\u8981\u6362\u6389\u5B83\uFF0C\u5FC5\u987B\u8BF4\u51FA\u5F88\u786C\u7684\u7406\u7531\u3002

**\u7B2C\u56DB\u6B65\uFF1A\u770B\u53D8\u73B0\u4EA7\u54C1\u548C\u6210\u4EA4\u7406\u7531\uFF0C\u8865\u591F\u4FE1\u4EFB\u5185\u5BB9**

\u4E13\u4E1A\u5C5E\u6027\u5F3A\u7684\u4EA7\u54C1\uFF08\u51CF\u8102\u3001\u533B\u7F8E\u3001\u54A8\u8BE2\u3001\u4EE3\u8FD0\u8425\u670D\u52A1\uFF09\u53EA\u9760\u5171\u9E23\u89C2\u70B9\uFF0C
\u4F1A\u5F97\u5230\u559C\u6B22\u4F46\u62FF\u4E0D\u5230\u4E13\u4E1A\u4FE1\u4EFB\uFF0C\u8981\u8865**\u77E5\u8BC6\u548C\u6652\u8FC7\u7A0B**\u6765\u8BC1\u660E"\u6211\u80FD\u505A\u6210"\uFF1B
\u6807\u51C6\u5316\u3001\u4F4E\u51B3\u7B56\u7684\u5546\u54C1\uFF08\u96F6\u98DF\uFF09\u9760\u4EBA\u683C\u559C\u7231\u5C31\u80FD\u6210\u4EA4\uFF0C\u4FE1\u4EFB\u5185\u5BB9\u53EF\u4EE5\u5C11\u3002
\u53D8\u73B0\u578B\u90A3\u4E00\u5757\u7528\u4EC0\u4E48\u5F62\u5F0F\uFF0C**\u6309\u5BA2\u4EBA\u4E3A\u4EC0\u4E48\u4E70\u4F60\u6765\u5B9A**\uFF08\u6210\u4EA4\u7406\u7531\uFF09\uFF1A
\u9760\u624B\u827A\u3001\u9760\u670D\u52A1\u8FC7\u7A0B \u2192 \u6652\u8FC7\u7A0B\uFF1B\u9760\u4E13\u4E1A\u5224\u65AD \u2192 \u6559\u77E5\u8BC6\uFF1B\u9760\u4EBA\u54C1\u3001\u9760\u5173\u7CFB \u2192 \u8BB2\u6545\u4E8B\u3002
\u8FD9\u4E00\u6B65\u51B3\u5B9A\u7684\u662F\u53D8\u73B0\u578B\u90A3\u4E00\u5757**\u7528\u4EC0\u4E48\u5F62\u5F0F\u505A**\uFF0C\u4E0D\u662F\u628A\u77E5\u8BC6\u578B\u62AC\u6210\u4E3B\u529B\u3002

**\u7B2C\u4E94\u6B65\uFF1A\u770B\u9898\u6750\uFF0C\u5B9A"\u4EBA\u7FA4\u5782\u76F4"\u7684\u6BD4\u4F8B**

\u5782\u76F4\u662F**\u4EBA\u7FA4\u5782\u76F4\uFF0C\u4E0D\u662F\u8D5B\u9053\u5782\u76F4**\uFF1A\u53EA\u8BB2\u81EA\u5DF1\u884C\u4E1A\u7684\u53F7\uFF0C\u6D41\u91CF\u5929\u82B1\u677F\u5C31\u662F\u884C\u4E1A\u91CC\u90A3\u70B9\u4EBA\u3002
\u9898\u6750\u6309 **\u4E3B\u8D5B\u9053 60-70% + \u76EE\u6807\u4EBA\u7FA4\u7684\u5174\u8DA3 30-40%** \u6765\u914D\u2014\u2014
\u6BD4\u5982\u88C5\u4FEE\u53F7\uFF0C6-7 \u6761\u8BB2\u88C5\u4FEE\uFF0C2-3 \u6761\u8BB2\u8FD9\u7FA4\u4EBA\u5173\u5FC3\u7684\u7701\u94B1\u3001\u751F\u6D3B\u65B9\u5F0F\u3002
\u4EBA\u7FA4\u5174\u8DA3\u90A3\u90E8\u5206\u901A\u5E38\u5C31\u662F\u6D41\u91CF\u578B\u5185\u5BB9\u7684\u6765\u6E90\uFF1B**\u7528\u6237\u8981\u5927\u6D41\u91CF\u65F6\uFF0C\u5F80 40% \u90A3\u5934\u9760**\u3002

---

**\u7ED9\u5B8C\u914D\u6BD4\u81EA\u5DF1\u6838\u4E00\u904D**\uFF08\u4EFB\u4F55\u4E00\u6761\u7B54"\u5426"\u5C31\u56DE\u53BB\u6539\uFF09\uFF1A
1. \u6D41\u91CF\u578B\u662F\u4E0D\u662F\u548C\u8D26\u53F7\u9636\u6BB5\u5339\u914D\uFF08\u65B0\u53F7\u662F\u4E0D\u662F\u6700\u5927\u7684\u4E00\u5757\uFF09\uFF1F
2. \u4E3B\u529B\u5F62\u5F0F\u662F\u4E0D\u662F\u6863\u6848\u91CC\u6570\u636E\u6700\u597D\u7684\u90A3\u4E00\u7C7B\uFF1F\u4E0D\u662F\u7684\u8BDD\u7406\u7531\u591F\u4E0D\u591F\u786C\uFF1F
3. \u7528\u6237\u8981\u5927\u6D41\u91CF\u7684\u8BDD\uFF0C\u884C\u4E1A\u5E72\u8D27\u662F\u4E0D\u662F\u6CA1\u5F53\u4E3B\u529B\uFF1F
4. \u9898\u6750\u6709\u6CA1\u6709\u7ED9\u76EE\u6807\u4EBA\u7FA4\u7684\u5174\u8DA3\u7559\u51FA 30-40%\uFF1F
5. \u6BCF\u4E2A\u6570\u5B57\u90FD\u80FD\u8BF4\u51FA"\u4E3A\u4EC0\u4E48\u662F\u8FD9\u4E2A\u6BD4\u4F8B"\u5417\uFF1F`;
var COHERENCE_CHECK = `### \u81EA\u6D3D\u68C0\u9A8C\uFF08\u5B9A\u4F4D\u6210\u4E0D\u6210\u7ACB\u770B\u8FD9\u4E09\u6761\uFF09

\u89C6\u9891\u662F\u591A\u8F68\u4FE1\u606F\u7CFB\u7EDF\uFF1A\u5E74\u9F84\u8EAB\u4EFD\u3001\u670D\u88C5\u3001\u573A\u666F\u3001\u706F\u5149\u3001\u9053\u5177\u3001\u8BF4\u8BDD\u59FF\u6001\u3001\u58F0\u97F3\u3001
\u5B57\u5E55\u3001\u526A\u8F91\u5171\u540C\u51B3\u5B9A\u53EF\u4FE1\u5EA6\u3002\u5E74\u8F7B\u4EBA\u5750\u8001\u677F\u6905\u8BB2\u6C89\u91CD\u5546\u4E1A\u7ECF\u9A8C\u3001\u751F\u6D3B\u5316\u53E3\u64AD\u91CC
\u7528\u534E\u4E3D\u4E66\u9762\u8BED\uFF0C\u90FD\u4F1A\u4E0D\u81EA\u6D3D\u3002**\u6B63\u786E\u987A\u5E8F\u662F\u5148\u5B9A"\u8FD9\u53E5\u8BDD\u8BE5\u7531\u8C01\u3001\u5728\u4EC0\u4E48\u573A\u666F\u3001
\u4EE5\u4EC0\u4E48\u72B6\u6001\u8BF4"\uFF0C\u518D\u5199\u6587\u6848\u3002**

\u65B9\u6848\u7ED9\u5B8C\u8981\u81EA\u5DF1\u8FC7\u4E00\u904D\uFF1A
1. \u906E\u4F4F\u5B57\u5E55\uFF0C\u8FD8\u80FD\u770B\u51FA\u8FD9\u4E2A\u8D26\u53F7\u7684\u6C14\u8D28\u5417\uFF1F
2. \u53EA\u542C\u58F0\u97F3\uFF0C\u8FD8\u80FD\u5224\u65AD\u51FA\u4EBA\u7269\u6027\u683C\u5417\uFF1F
3. \u5934\u50CF\u3001\u4E3B\u9875\u7B80\u4ECB\u3001\u5355\u6761\u89C6\u9891\u653E\u5728\u4E00\u8D77\uFF0C\u4F1A\u4E0D\u4F1A\u50CF\u4E09\u4E2A\u4E0D\u540C\u7684\u8D26\u53F7\uFF1F`;
var PLATFORM_NOTES = {
  \u6296\u97F3: "\u7B97\u6CD5\u4EE5\u5B8C\u64AD\u548C\u4E92\u52A8\u4E3A\u4E3B\uFF0C\u524D3\u79D2\u51B3\u5B9A\u751F\u6B7B\uFF1B\u6CDB\u6D41\u91CF\u5927\u4F46\u7CBE\u51C6\u5EA6\u9760\u5185\u5BB9\u81EA\u5DF1\u5708\uFF1B\u9002\u5408\u5F3A\u94A9\u5B50\u3001\u5F3A\u60C5\u7EEA\u3001\u5F3A\u8282\u594F\u3002",
  \u5FEB\u624B: "\u8001\u94C1\u5173\u7CFB\u4E0E\u79C1\u57DF\u66F4\u91CD\uFF0C\u771F\u5B9E\u611F\u548C\u6301\u7EED\u9732\u8138\u6BD4\u7CBE\u81F4\u5EA6\u91CD\u8981\uFF1B\u76F4\u64AD\u5E26\u8D27\u94FE\u8DEF\u6210\u719F\uFF0C\u9002\u5408\u628A\u4FE1\u4EFB\u6C89\u6DC0\u5230\u76F4\u64AD\u95F4\u3002",
  \u5C0F\u7EA2\u4E66: "\u641C\u7D22\u5C5E\u6027\u5F3A\uFF0C\u7528\u6237\u5E26\u7740\u95EE\u9898\u6765\uFF1B\u6807\u9898\u548C\u5C01\u9762\u6587\u5B57\u627F\u62C5\u5927\u90E8\u5206\u70B9\u51FB\uFF1B\u9002\u5408\u77E5\u8BC6\u578B\u3001\u6E05\u5355\u578B\u3001\u907F\u5751\u578B\u5185\u5BB9\u3002",
  \u89C6\u9891\u53F7: "\u793E\u4EA4\u5173\u7CFB\u94FE\u63A8\u8350\uFF0C\u4E2D\u8001\u5E74\u7528\u6237\u5360\u6BD4\u9AD8\uFF1B\u5185\u5BB9\u8981\u6162\u4E00\u70B9\u3001\u5B57\u8981\u5927\u4E00\u70B9\uFF1B\u9002\u5408\u505A\u672C\u5730\u751F\u610F\u548C\u719F\u4EBA\u8F6C\u4ECB\u7ECD\u3002",
  B\u7AD9: '\u957F\u5185\u5BB9\u5BB9\u5FCD\u5EA6\u9AD8\uFF0C\u7528\u6237\u5403"\u5E72\u8D27\u5BC6\u5EA6"\u548C\u771F\u8BDA\uFF1B\u9002\u5408\u7CFB\u7EDF\u6027\u8BB2\u89E3\u548C\u8FC7\u7A0B\u8BB0\u5F55\uFF0C\u4E0D\u9002\u5408\u786C\u94A9\u5B50\u5957\u8DEF\u3002'
};
function platformSection(platform) {
  const note = platform ? PLATFORM_NOTES[platform] : "";
  if (!note) {
    return `### \u5E73\u53F0

\u6863\u6848\u91CC\u6CA1\u5199\u660E\u4E3B\u5E73\u53F0\u3002**\u4E0D\u8981\u5047\u8BBE\u662F\u6296\u97F3**\uFF0C\u7ED9\u51FA\u7684\u65B9\u5411\u8981\u5728\u4E3B\u6D41\u5E73\u53F0\u901A\u7528\uFF1B
\u5982\u679C\u67D0\u6761\u5EFA\u8BAE\u5F3A\u4F9D\u8D56\u7279\u5B9A\u5E73\u53F0\u7684\u673A\u5236\uFF0C\u8BF7\u6807\u6CE8"\u6B64\u6761\u9002\u7528\u4E8EXX\u5E73\u53F0"\u3002`;
  }
  return `### \u5E73\u53F0\uFF1A${platform}

${note}

\u65B9\u6848\u91CC\u6D89\u53CA\u5206\u53D1\u3001\u94A9\u5B50\u5F3A\u5EA6\u3001\u5185\u5BB9\u957F\u5EA6\u7684\u5224\u65AD\uFF0C\u90FD\u8981\u6309\u8FD9\u4E2A\u5E73\u53F0\u7684\u7279\u6027\u6765\uFF0C
\u4E0D\u8981\u5957\u7528\u5176\u4ED6\u5E73\u53F0\u7684\u7ECF\u9A8C\u3002`;
}
var OUTPUT_FULL = `## \u{1F4E4} \u8F93\u51FA\u683C\u5F0F

\u6309\u4E0B\u9762\u7684\u987A\u5E8F\u8F93\u51FA\uFF0C\u6807\u9898\u539F\u6837\u4FDD\u7559\u3002\u4E0D\u8981\u6709\u524D\u8A00\uFF0C\u4E0D\u8981\u590D\u8FF0\u6211\u7ED9\u4F60\u7684\u6863\u6848\u3002

# \u{1F3AF} \u8D26\u53F7\u5B9A\u4F4D\u65B9\u6848

## \u{1F4CC} \u6838\u5FC3\u7ED3\u8BBA\uFF08\u5148\u770B\u8FD9 8 \u6761\uFF09

\u6574\u4EFD\u65B9\u6848\u7684\u7ED3\u8BBA\u538B\u7F29\u5728\u8FD9\u91CC\uFF0C\u6BCF\u6761\u4E00\u884C\u3001\u4E0D\u8D85\u8FC7 25 \u5B57\uFF0C\u770B\u5B8C\u5C31\u77E5\u9053\u8BE5\u5E72\u4EC0\u4E48\uFF1A

1. **\u8FD9\u662F\u4EC0\u4E48\u53F7**\uFF1A\u4E3B\u4F53\u7C7B\u578B\uFF08\u6DF7\u5408\u578B\u5199\u660E\u4E3B\u7EBF/\u526F\u7EBF\uFF09+ \u4E00\u53E5\u8BDD\u5B9A\u4F4D
2. **\u7ED9\u8C01\u770B**\uFF1A\u4E00\u53E5\u8BDD\u753B\u50CF
3. **\u4EBA\u8BBE\u6807\u7B7E**\uFF1A\u80FD\u88AB\u590D\u8FF0\u7684\u90A3\u53E5\u8BDD
4. **\u4E3B\u6253\u5185\u5BB9**\uFF1A\u6D41\u91CF/\u4EBA\u8BBE/\u53D8\u73B0\u5404\u5360\u591A\u5C11 + \u4E3B\u529B\u5F62\u5F0F\u662F\u4EC0\u4E48 + \u4E3A\u4EC0\u4E48
5. **\u600E\u4E48\u8D5A\u94B1**\uFF1A\u6210\u4EA4\u8DEF\u5F84\u4E00\u53E5\u8BDD
6. **\u7B2C\u4E00\u6761\u62CD\u4EC0\u4E48**
7. **\u6700\u8BE5\u907F\u5F00\u7684\u5751**
8. **\u591A\u4E45\u80FD\u770B\u51FA\u8DD1\u6CA1\u8DD1\u901A**

\u4E0B\u9762\u662F\u5C55\u5F00\u8BBA\u8BC1\uFF0C\u60F3\u7EC6\u770B\u518D\u5F80\u4E0B\u7FFB\u3002

---

## \u{1F50D} \u5148\u8BF4\u8FD9\u4E00\u884C

**\u4E0D\u8981\u4ECE\u8D26\u53F7\u8BB2\u8D77\uFF0C\u5148\u8BB2\u8FD9\u95E8\u751F\u610F\u3002** \u8FD9\u4E00\u8282\u51B3\u5B9A\u4E86\u5BA2\u6237\u770B\u5B8C\u7B2C\u4E00\u5C4F\u4FE1\u4E0D\u4FE1\u4F60\u3002

- **\u5F52\u53E3**\uFF1A\u5C5E\u4E8E 12 \u7C7B\u91CC\u7684\u54EA\u4E00\u7C7B\uFF0C\u8DE8\u7C7B\u7684\u8BF4\u660E\u4E3B\u6B21
- **\u8FD9\u884C\u7684\u94B1\u600E\u4E48\u8D5A**\uFF1A\u6BDB\u5229\u7ED3\u6784\u3001\u9760\u5BA2\u5355\u8FD8\u662F\u590D\u8D2D\u3001\u83B7\u5BA2\u6210\u672C\u5361\u5728\u54EA
- **\u5BA2\u4EBA\u7684\u51B3\u7B56\u94FE\u8DEF**\uFF1A\u770B\u5B8C\u5C31\u6765\uFF0C\u8FD8\u662F\u8981\u6BD4\u4EF7\u3001\u95EE\u4EBA\u3001\u7B49\u65F6\u673A\uFF1B\u5927\u6982\u591A\u4E45\u51B3\u5B9A
- **\u65F6\u95F4\u89C4\u5F8B**\uFF1A\u6DE1\u65FA\u5B63\u3001\u65F6\u6BB5\u3001\u8282\u65E5\u8282\u70B9
- **\u8FD9\u884C\u8001\u677F\u666E\u904D\u4F1A\u72AF\u7684\u9519**\uFF1A\u6700\u5E38\u89C1\u7684\u81EA\u55E8\u70B9\u662F\u4EC0\u4E48\uFF0C\u8FD9\u4E2A\u5BA2\u6237\u6709\u6CA1\u6709\u4E2D\u62DB
- **\u540C\u884C\u73B0\u5728\u90FD\u5728\u62CD\u4EC0\u4E48**\uFF1A\u4E3A\u4EC0\u4E48\u5927\u591A\u6570\u6CA1\u6548\u679C\uFF0C\u7A7A\u6863\u5728\u54EA

\u26A0\uFE0F \u8FD9\u4E00\u8282\u5199\u7684\u662F**\u6863\u6848\u91CC\u6CA1\u6709\u7684\u4E1C\u897F**\u3002\u5168\u9760\u590D\u8FF0\u7528\u6237\u586B\u7684\u5185\u5BB9\uFF0C\u8FD9\u4E00\u8282\u5C31\u767D\u5199\u4E86\u3002

## \u{1F5E3} \u6211\u4F1A\u5148\u95EE\u8001\u677F\u7684\u51E0\u4E2A\u95EE\u9898

\u5217\u51FA 4-6 \u6761\uFF0C\u6BCF\u6761\u90FD\u6309\u8FD9\u4E00\u884C\u7684\u5E38\u8BC6**\u5148\u7ED9\u51FA\u4F60\u7684\u63A8\u6D4B**\uFF0C\u5E76\u6807\u660E"\u5F85\u786E\u8BA4"\u3002
\u91CD\u70B9\u5FC5\u987B\u5305\u542B\u8FD9\u4E00\u6761\uFF1A**\u771F\u6B63\u7684\u5DEE\u5F02\u5316\u662F\u4EC0\u4E48\u2014\u2014\u987E\u5BA2\u611F\u53D7\u5230\u7684\uFF0C\u800C\u4E0D\u662F\u8001\u677F\u4EE5\u4E3A\u7684**\u3002

\u683C\u5F0F\uFF1A
- **\u95EE\u9898**\uFF1A\u2026
  - **\u6211\u7684\u63A8\u6D4B**\uFF1A\u2026\uFF08\u8BF4\u660E\u4F9D\u636E\uFF09
  - \u5F85\u8001\u677F\u786E\u8BA4

## \u4E00\u53E5\u8BDD\u5B9A\u4F4D
[\u8EAB\u4EFD] + [\u7279\u70B9] + [\u4EF7\u503C]\uFF0C\u4E00\u53E5\u8BDD\uFF0C\u4E0D\u8D85\u8FC730\u5B57\u3002\u8FD9\u53E5\u8BDD\u8981\u80FD\u8BA9\u964C\u751F\u4EBA\u7ACB\u523B\u77E5\u9053\u8BE5\u4E0D\u8BE5\u5173\u6CE8\u3002
\u7528\u6237\u5728\u8865\u5145\u8BF4\u660E\u91CC\u5199\u4E86\u81EA\u5DF1\u7684\u6838\u5FC3\u5B9A\u4F4D\u7684\uFF0C**\u5728\u90A3\u53E5\u8BDD\u7684\u57FA\u7840\u4E0A\u6253\u78E8**\uFF1A\u4ED6\u539F\u8BDD\u91CC\u7684\u6838\u5FC3\u77ED\u8BED\u8981**\u539F\u6837\u51FA\u73B0**\u5728\u8FD9\u53E5\u8BDD\u91CC\uFF0C
\u4F60\u53EA\u8865\u8EAB\u4EFD\u3001\u5730\u57DF\u3001\u4EF7\u503C\u8FD9\u4E9B\u4ED6\u6CA1\u8BF4\u6E05\u7684\u90E8\u5206\uFF0C\u4E0D\u8981\u53E6\u8D77\u4E00\u53E5\u3002

## \u516D\u7EF4\u5730\u57FA

### 1. \u4EBA\u8BBE\u5B9A\u4F4D

\u26A0\uFE0F **\u8FD9\u4E00\u7EF4\u662F\u91CD\u707E\u533A\uFF0C\u6700\u5BB9\u6613\u5199\u6210"\u4E13\u4E1A\u3001\u9760\u8C31\u3001\u6709\u6E29\u5EA6"\u8FD9\u79CD\u8C01\u90FD\u80FD\u7528\u7684\u8BCD\u3002**
\u6863\u6848\u91CC\u90A3\u4E9B\u5F62\u5BB9\u8BCD\u662F**\u539F\u6599**\uFF0C\u4E0D\u662F\u7B54\u6848\u3002\u4F60\u8981\u505A\u7684\u662F\u4ECE\u539F\u6599\u91CC\u63D0\u70BC\u51FA\u4E00\u4E2A
**\u5177\u4F53\u5230\u80FD\u88AB\u590D\u8FF0**\u7684\u4EBA\u8BBE\u2014\u2014\u89C2\u4F17\u80FD\u8DDF\u670B\u53CB\u4E00\u53E5\u8BDD\u8F6C\u8FF0\u51FA\u6765\u7684\u90A3\u79CD\u3002

\u53CD\u9762\u4F8B\u5B50\uFF1A\u300C\u4E13\u4E1A\u7684\u672C\u5730\u4EE3\u8FD0\u8425\uFF0C\u6709\u6E29\u5EA6\u3001\u91CD\u4EBA\u60C5\u300D\u2190 \u8FD9\u662F\u539F\u6599\u590D\u8FF0\uFF0C\u7B49\u4E8E\u6CA1\u5B9A\u4F4D
\u6B63\u9762\u4F8B\u5B50\uFF1A\u300C\u4E0D\u6536\u9884\u4ED8\u6B3E\u3001\u5148\u5E72\u51FA\u6548\u679C\u518D\u8C08\u94B1\u7684\u53BF\u57CE\u7F16\u5BFC\u300D\u2190 \u5177\u4F53\u3001\u53EF\u9A8C\u8BC1\u3001\u80FD\u590D\u8FF0

\u5FC5\u987B\u8F93\u51FA\uFF1A
- **\u539F\u6599\u5728\u54EA**\uFF1A\u5148\u6307\u51FA\u6863\u6848\u91CC\u54EA\u51E0\u53E5\u662F\u4EBA\u8BBE\u7684\u771F\u6750\u6599\uFF08\u539F\u8BDD\u5F15\u51FA\u6765\uFF09\uFF0C
  \u54EA\u4E9B\u53EA\u662F\u5F62\u5BB9\u8BCD\u3002**\u628A\u5F62\u5BB9\u8BCD\u7FFB\u8BD1\u6210\u5177\u4F53\u884C\u4E3A**\u2014\u2014
  "\u91CD\u611F\u60C5\u3001\u8BB2\u4EBA\u60C5\u4E16\u6545"\u7FFB\u8BD1\u8FC7\u6765\u53EF\u80FD\u662F"\u63A5\u5355\u5148\u770B\u8001\u677F\u4EBA\u54C1\uFF0C\u4E0D\u5408\u9002\u7684\u94B1\u4E0D\u8D5A"
- **\u4EBA\u8BBE\u6807\u7B7E\u53E5**\uFF1A\u4E00\u53E5\u8BDD\uFF0C\u4E0D\u8D85\u8FC720\u5B57\uFF0C\u8981\u80FD\u88AB\u590D\u8FF0
- **\u7528\u4E86\u54EA\u4E2A\u5165\u53E3**\uFF1A\u75DB\u70B9+\u804C\u4E1A / \u7279\u6B8A\u7ECF\u5386 / \u5916\u5F62\u8EAB\u4EFD / \u6027\u683C / \u5173\u7CFB / \u53CD\u5DEE
- **\u9A8C\u8BC1**\uFF1A\u6B63\u9762\u56DE\u7B54\u8FD9\u4E2A\u5165\u53E3\u7684\u9A8C\u8BC1\u95EE\u9898\uFF0C\u8BF4\u660E\u4E3A\u4EC0\u4E48\u7ACB\u5F97\u4F4F
- **\u5728\u540C\u7C7B\u8D26\u53F7\u91CC\u7684\u4F4D\u7F6E**\uFF1A\u540C\u884C\u90FD\u5728\u7528\u4EC0\u4E48\u4EBA\u8BBE\uFF08\u5927\u5E08\u578B\uFF1F\u6570\u636E\u578B\uFF1F\u6848\u4F8B\u578B\uFF1F\uFF09\uFF0C
  \u4F60\u8FD9\u4E2A\u548C\u4ED6\u4EEC\u5DEE\u5728\u54EA\u3002**\u8BF4\u4E0D\u51FA\u5DEE\u522B\u5C31\u7B49\u4E8E\u6CA1\u5DEE\u5F02\u5316**
- **\u8BC1\u636E\u94FE**\uFF1A\u63A5\u4E0B\u6765\u9760\u54EA 3-4 \u7C7B\u5185\u5BB9\u6301\u7EED\u8BC1\u660E\u8FD9\u4E2A\u4EBA\u8BBE
- **\u8FB9\u754C**\uFF1A\u4EC0\u4E48\u8BDD\u4E00\u8BF4\u4EBA\u8BBE\u5C31\u5D29\uFF08\u7ED3\u5408\u6863\u6848\u91CC\u7684\u7981\u5FCC\uFF09

### 2. \u7528\u6237\u5B9A\u4F4D

\u26A0\uFE0F **\u4E0D\u8981\u628A\u6863\u6848\u91CC\u7684\u75DB\u70B9\u6E05\u5355\u6284\u4E00\u904D\u3002** \u6863\u6848\u91CC\u52FE\u7684\u662F\u9009\u9879\uFF0C\u4F60\u8981\u7ED9\u7684\u662F
**\u4E00\u4E2A\u5177\u4F53\u7684\u4EBA**\u2014\u2014\u5177\u4F53\u5230\u770B\u5B8C\u80FD\u5728\u8111\u5B50\u91CC\u60F3\u8D77\u67D0\u4E2A\u771F\u5B9E\u5BA2\u6237\u7684\u6837\u5B50\u3002

\u5FC5\u987B\u8F93\u51FA\uFF1A
- **\u4E00\u53E5\u8BDD\u753B\u50CF**\uFF1A\u628A\u4EBA\u7269\u5199\u6D3B\u3002
  \u53CD\u9762\uFF1A\u300C25-40\u5C81\u7684\u672C\u5730\u5546\u5BB6\u300D\uFF1B\u6B63\u9762\uFF1A\u300C\u5F00\u4E86\u516D\u4E03\u5E74\u3001\u8FD9\u4E24\u5E74\u660E\u663E\u611F\u89C9\u5BA2\u6D41\u5728\u6389\u3001
  \u81EA\u5DF1\u62FF\u624B\u673A\u62CD\u8FC7\u5341\u51E0\u6761\u6CA1\u6C34\u82B1\u3001\u88AB\u4E0A\u4E00\u4E2A\u4EE3\u8FD0\u8425\u6536\u8FC7\u94B1\u7684\u53BF\u57CE\u9910\u9986\u8001\u677F\u300D
- **\u4E3A\u4EC0\u4E48\u662F\u4ED6\u4EEC\u3001\u4E0D\u662F\u53E6\u4E00\u6279**\uFF1A\u660E\u786E\u8BF4\u51FA**\u4F60\u4E0D\u670D\u52A1\u8C01**\uFF08\u6BD4\u5982\u521A\u5F00\u4E1A\u6CA1\u9884\u7B97\u7684\u3001
  \u671F\u5F85\u4E00\u4E2A\u6708\u7206\u706B\u7684\uFF09\u3002\u4E0D\u6562\u6392\u9664\u4EBA\u7FA4 = \u5B9A\u4F4D\u6CA1\u505A\u5B8C
- **\u4ED6\u4EEC\u5FC3\u91CC\u771F\u6B63\u5728\u60F3\u4EC0\u4E48**\uFF1A\u4E0D\u662F\u6863\u6848\u91CC\u90A3\u51E0\u4E2A\u8BCD\uFF0C\u662F**\u4ED6\u5634\u4E0A\u4E0D\u4F1A\u8BF4\u7684\u90A3\u53E5\u8BDD**\u3002
  \u88AB\u5751\u8FC7\u7684\u4EBA\u5FC3\u91CC\u90A3\u53E5\u5F80\u5F80\u662F"\u4F60\u4EEC\u8BF4\u5F97\u90FD\u597D\u542C"
- **\u51B3\u7B56\u94FE\u8DEF**\uFF1A\u4ED6\u4ECE\u5237\u5230\u4F60\u5230\u8054\u7CFB\u4F60\uFF0C\u4E2D\u95F4\u4F1A\u505A\u4EC0\u4E48\uFF08\u6F5C\u6C34\u591A\u4E45\u3001
  \u4F1A\u4E0D\u4F1A\u95EE\u540C\u884C\u3001\u4F1A\u4E0D\u4F1A\u5148\u5C0F\u989D\u8BD5\u6C34\uFF09\u2014\u2014**\u8FD9\u51B3\u5B9A\u5185\u5BB9\u8981\u94FA\u591A\u957F\u7684\u4FE1\u4EFB**
- **\u4EC0\u4E48\u65F6\u523B\u4F1A\u60F3\u8D77\u4F60**\uFF1A\u5177\u4F53\u5230\u573A\u666F\u548C\u65F6\u95F4\u70B9\uFF0C\u4E0D\u8981\u5199"\u6709\u9700\u6C42\u7684\u65F6\u5019"
- **\u4ED6\u5728\u5E73\u53F0\u4E0A\u641C\u4EC0\u4E48**\uFF1A\u5199\u51FA\u4ED6\u771F\u4F1A\u6253\u51FA\u6765\u7684\u90A3\u51E0\u4E2A\u8BCD

### 3. \u5185\u5BB9\u5B9A\u4F4D

\u26A0\uFE0F **\u4E0D\u8981\u53EA\u7ED9\u4E00\u4E2A\u914D\u6BD4\u8868\u5C31\u5B8C\u4E8B\u3002** \u914D\u6BD4\u662F\u7ED3\u679C\uFF0C\u524D\u9762\u5F97\u6709\u63A8\u5BFC\u3002

\u5FC5\u987B\u8F93\u51FA\uFF1A
- **\u957F\u671F\u63D0\u4F9B\u4EC0\u4E48\u4EF7\u503C**\uFF1A\u4E00\u53E5\u8BDD\uFF0C\u226425\u5B57
- **\u5185\u5BB9\u65B9\u5411**\uFF1A\u591A\u5143\u56DB\u7C7B\u8FD8\u662F\u5355\u4E00\u4E3B\u9898\uFF08\u6309\u300C\u5148\u5B9A\u5185\u5BB9\u65B9\u5411\u300D\u5224\u65AD\uFF09\uFF0C\u4E00\u53E5\u8BDD\u7406\u7531\uFF1B
  \u9009\u4E86\u5355\u4E00\u4E3B\u9898\u7684\uFF0C\u4E00\u53E5\u8BDD\u8BF4\u51FA\u4E3B\u9898
- **\u5F53\u524D\u9636\u6BB5\u914D\u6BD4**\uFF1A\u4E25\u683C\u6309\u4E0A\u9762\u300C\u5185\u5BB9\u914D\u6BD4\u300D\u7684\u4E94\u6B65\u63A8\uFF0C**\u4E09\u5C42\u90FD\u8981\u7ED9**\uFF1A
  - \u4F5C\u7528\u914D\u6BD4\uFF1A\u6D41\u91CF\u578B / \u4EBA\u8BBE\u578B / \u53D8\u73B0\u578B \u5404\u5360\u591A\u5C11\uFF0C\u4F9D\u636E\u662F\u8D26\u53F7\u9636\u6BB5\u548C\u7528\u6237\u7684\u76EE\u6807
  - \u6BCF\u4E00\u5757\u7528\u4EC0\u4E48\u5F62\u5F0F\u505A\uFF08\u77E5\u8BC6/\u6545\u4E8B/\u8FC7\u7A0B/\u89C2\u70B9/\u6BB5\u5B50\uFF09\uFF0C\u5E76\u8BF4\u660E\u4E3A\u4EC0\u4E48
  - \u9898\u6750\uFF1A\u4E3B\u8D5B\u9053\u548C\u76EE\u6807\u4EBA\u7FA4\u5174\u8DA3\u5404\u5360\u591A\u5C11
- **\u4E3B\u529B\u5F62\u5F0F**\uFF1A\u5C31\u662F\u6863\u6848\u91CC"\u6570\u636E\u6700\u597D\u7684\u5185\u5BB9\u7C7B\u578B"\u3002\u8981\u6362\u6389\u5B83\uFF0C\u5FC5\u987B\u8BF4\u51FA\u5F88\u786C\u7684\u7406\u7531
- **\u6BCF\u7C7B\u5185\u5BB9\u7BA1\u54EA\u4E00\u6BB5\u8DEF**\uFF1A\u628A\u7528\u6237\u4ECE\u300C\u4E0D\u8BA4\u8BC6\u4F60\u300D\u5230\u300C\u627E\u4F60\u300D\u62C6\u6210\u51E0\u6B65
  \uFF08\u5237\u5230 \u2192 \u8BB0\u4F4F \u2192 \u4FE1 \u2192 \u8054\u7CFB\uFF09\uFF0C**\u8BF4\u660E\u54EA\u7C7B\u5185\u5BB9\u8D1F\u8D23\u54EA\u4E00\u6B65**\u3002
  \u53EA\u5806\u914D\u6BD4\u4E0D\u8BF4\u660E\u8FD9\u4E2A\uFF0C\u7B49\u4E8E\u6CA1\u89C4\u5212
- **\u4E09\u79CD\u89C6\u9891\u5404\u600E\u4E48\u62CD**\uFF1A\u6309\u300C\u4E09\u79CD\u89C6\u9891\u300D\u90A3\u4E00\u6BB5\uFF0C\u6D41\u91CF\u578B / \u4EBA\u8BBE\u578B / \u53D8\u73B0\u578B\u5404\u5199\u4E24\u884C\uFF0C**\u4E24\u5957\u6253\u6CD5\u90FD\u7ED9**\uFF1A
  - \u56DB\u5927\u811A\u672C\uFF1A\u7ED9\u8FD9\u4E2A\u53F7\u7684\u65B9\u5411 + \u7528\u54EA\u4E2A\u811A\u672C\u7ED3\u6784 + \u7ED3\u5C3E\u884C\u52A8\u6307\u4EE4\uFF08\u53EA\u5199\u4E00\u4E2A\uFF09
  - \u8D77\u53F736\u8BA1\uFF1A\u4ECE\u6807\u4E86\u8FD9\u4E00\u79CD\u7684\u8BA1\u91CC\u6311 1 \u8BA1\u4ED6\u62CD\u5F97\u51FA\u6765\u7684\uFF0C\u5199\u6210"\u7B2CN\u8BA1\xB7\u8BA1\u540D\uFF1A\u516C\u5F0F\u5957\u5230\u8FD9\u4E2A\u53F7\u4E0A\u662F\u4EC0\u4E48\u4E8B\u4EF6"
- **\u914D\u6BD4\u6838\u9A8C**\uFF1A\u628A\u300C\u5185\u5BB9\u914D\u6BD4\u300D\u672B\u5C3E\u90A3\u4E94\u6761\u6838\u9A8C\u9010\u6761\u5199\u51FA\u7ED3\u679C\uFF08\u662F / \u5426 + \u4E00\u53E5\u8BDD\uFF09\uFF0C\u4E0D\u8981\u8DF3\u8FC7
- **\u7B2C\u4E00\u6761\u8BE5\u53D1\u4EC0\u4E48**\uFF1A\u5177\u4F53\u5230\u80FD\u62CD\uFF0C\u8BF4\u660E\u4E3A\u4EC0\u4E48\u662F\u5B83\u5F00\u573A\uFF1B\u5B83\u4E5F**\u53EA\u62C5\u4E00\u4E2A\u76EE\u7684**\uFF0C\u5199\u660E\u662F\u54EA\u79CD\u3001\u7528\u7684\u54EA\u5957\u6253\u6CD5
  \uFF08\u4E0D\u8981\u5199"\u8FD9\u6761\u540C\u65F6\u670D\u52A1\u6D41\u91CF\u3001\u4EBA\u8BBE\u3001\u53D8\u73B0"\u2014\u2014\u4E09\u4E2A\u90FD\u8981\u7B49\u4E8E\u4E09\u4E2A\u90FD\u5931\u8D25\uFF09

\u26A0\uFE0F \u8FD9\u91CC**\u4E0D\u8981\u5C55\u5F00\u5199\u5185\u5BB9\u7CFB\u5217\u548C\u6392\u671F**\u2014\u2014\u90A3\u662F\u300C\u5185\u5BB9\u5B9A\u4F4D\u300D\u677F\u5757\u7684\u6D3B\u3002
\u8FD9\u4E00\u7EF4\u53EA\u56DE\u7B54"\u957F\u671F\u63D0\u4F9B\u4EC0\u4E48\u4EF7\u503C\u3001\u4E3B\u6253\u4EC0\u4E48\u7C7B\u578B\u3001\u4E3A\u4EC0\u4E48\u3001\u600E\u4E48\u914D\u6BD4"\u3002

### 4. \u5448\u73B0\u5B9A\u4F4D\uFF08\u53EA\u7ED9\u7ED3\u8BBA\uFF0C\u2264200\u5B57\uFF09
- **\u4E3B\u8981\u5F62\u5F0F**\uFF1A\u4ECE\u56FE\u6587/\u53E3\u64AD/\u89C6\u9891\u914D\u97F3Vlog/\u60C5\u666F\u5267\u91CC\u9009\uFF0C\u4E00\u53E5\u8BDD\u8BF4\u660E\u4E3A\u4EC0\u4E48
- **\u4EA7\u80FD**\uFF1A\u4E00\u5468\u80FD\u7A33\u5B9A\u4EA7\u51E0\u6761\uFF0C\u4F9D\u636E\u662F\u6863\u6848\u91CC\u7684\u56E2\u961F\u548C\u65F6\u95F4
- **\u5728\u54EA\u62CD**\uFF1A\u8FD9\u4E2A\u53F7\u7684\u5185\u5BB9\u8BE5\u5728\u4EC0\u4E48\u73B0\u573A\u62CD

### 5. \u98CE\u683C\u8C03\u6027\uFF08\u53EA\u7ED9\u7ED3\u8BBA\uFF0C\u2264200\u5B57\uFF09
- **\u6B63\u5411\u5339\u914D\u8FD8\u662F\u6709\u610F\u53CD\u5DEE**\uFF1A\u9009\u4E00\u4E2A + \u4E00\u53E5\u8BDD\u7406\u7531
- **\u6C14\u8D28\u5173\u952E\u8BCD**\uFF1A3\u4E2A
- **\u4F1A\u8BF4\u7684\u4E00\u53E5\u8BDD / \u4E0D\u4F1A\u8BF4\u7684\u4E00\u53E5\u8BDD**\uFF1A\u5404\u4E3E\u4E00\u4E2A\u771F\u5B9E\u4F8B\u5B50\uFF08\u8FD9\u6BD4\u5F62\u5BB9\u8BCD\u6709\u7528\uFF09

### 6. \u53D8\u73B0\u5B9A\u4F4D\uFF08\u53EA\u7ED9\u7ED3\u8BBA\uFF0C\u2264250\u5B57\uFF09
\u26A0\uFE0F **\u4E0D\u8981\u5C55\u5F00\u5199**\u3002\u8FD9\u4E2A\u53F7\u7684\u53D8\u73B0\u6709\u72EC\u7ACB\u7684\u300C\u5546\u4E1A\u5B9A\u4F4D\u300D\u677F\u5757\u4E13\u95E8\u6DF1\u6316\uFF0C
\u8FD9\u91CC\u5199\u957F\u4E86\u5C31\u662F\u91CD\u590D\u5EFA\u8BBE\u3002\u53EA\u7ED9\u56DB\u6761\uFF1A
- **\u5356\u4EC0\u4E48** + **\u5BA2\u5355\u4EF7\u533A\u95F4**
- **\u6210\u4EA4\u8DEF\u5F84**\uFF1A\u4E00\u884C\u7BAD\u5934\u56FE\uFF0C\u4E0D\u8981\u9010\u6B65\u5206\u6790
- **\u6700\u7F3A\u7684\u4FE1\u4EFB\u8BC1\u636E\u662F\u4EC0\u4E48**\uFF1A\u4E00\u53E5\u8BDD
- \u7ED3\u5C3E\u5199\u4E00\u53E5\uFF1A\u5B8C\u6574\u7684\u53D8\u73B0\u62C6\u89E3\u8BF7\u7528\u300C\u5546\u4E1A\u5B9A\u4F4D\u300D\u677F\u5757

## \u{1F9E0} \u8BB0\u5FC6\u70B9\u8BBE\u8BA1
\u4ECE\u8BED\u8A00/\u52A8\u4F5C/\u9053\u5177/\u670D\u88C5/\u573A\u666F\u58F0\u97F3\u4E94\u7C7B\u91CC\uFF0C\u7ED9 2-3 \u4E2A\u5177\u4F53\u5EFA\u8BAE\u3002
\u6BCF\u4E2A\u90FD\u8981\u8BF4\u660E\uFF1A\u600E\u4E48\u91CD\u590D\u3001\u4E3A\u4EC0\u4E48\u548C\u8FD9\u4E2A\u5B9A\u4F4D\u6709\u5173\u3002
**\u6807\u660E\u54EA\u4E9B\u662F\u5F85\u9A8C\u8BC1\u7684**\u2014\u2014\u6700\u7EC8\u7559\u54EA\u4E2A\uFF0C\u8981\u770B\u8BC4\u8BBA\u533A\u81EA\u5DF1\u63D0\u5230\u4E86\u4EC0\u4E48\u3002

## \u26A1 \u5DEE\u5F02\u5316\uFF1AA + \u53D8\u91CFB
\u4E0D\u8981\u53EA\u5199"\u522B\u4EBA\u662F\u2026\u4F60\u662F\u2026"\u3002\u6309\u4E0B\u9762\u4E09\u6B65\u7ED9\u51FA 2-3 \u7EC4\uFF1A
1. **\u5E38\u89C4A**\uFF1A\u540C\u884C\u73B0\u5728\u6700\u5E38\u89C1\u7684\u9009\u9898\u548C\u5F62\u5F0F\u662F\u4EC0\u4E48
2. **\u53D8\u91CFB**\uFF1A\u4ECE24\u5143\u7D20\u91CC\u9009\u4E00\u4E2A\uFF08\u4EBA\u7269/\u60C5\u5883/\u884C\u4E3A/\u8868\u8FBE\uFF09\uFF0C\u8BF4\u660E\u9009\u5B83\u7684\u7406\u7531
3. **A+B \u957F\u4EC0\u4E48\u6837**\uFF1A\u5177\u4F53\u5230\u80FD\u62CD\u7684\u7A0B\u5EA6\uFF0C\u5E76\u8BF4\u660E\u5B83\u670D\u52A1\u7684\u662F\u76EE\u6807\u7528\u6237\u800C\u4E0D\u662F\u81EA\u55E8

## \u{1F4C7} \u8D26\u53F7\u4E94\u4EF6\u5957\uFF08\u53EF\u4EE5\u4ECA\u5929\u5C31\u6539\uFF09
\u7ED9\u51FA\u53EF\u4EE5\u76F4\u63A5\u6284\u53BB\u7528\u7684\u5177\u4F53\u5185\u5BB9\uFF0C\u4E0D\u8981\u5199"\u5EFA\u8BAE\u4F18\u5316\u5934\u50CF"\u8FD9\u79CD\u5E9F\u8BDD\uFF1A
- **\u5934\u50CF**\uFF1A\u62CD\u4EC0\u4E48\u3001\u8C01\u51FA\u955C
- **\u6635\u79F0**\uFF1A\u7ED9\u51FA 2-3 \u4E2A\u5907\u9009\uFF0C\u8981\u80FD\u88AB\u76EE\u6807\u4EBA\u7FA4\u641C\u5230
- **\u7B80\u4ECB**\uFF1A\u76F4\u63A5\u5199\u51FA\u6765\uFF0C\u226460\u5B57\uFF0C\u53E3\u8BED\u5316\uFF0C\u5305\u542B"\u6211\u662F\u8C01 + \u80FD\u5E2E\u4F60\u4EC0\u4E48 + \u600E\u4E48\u627E\u6211"
- **\u80CC\u666F\u56FE**\uFF1A\u653E\u4EC0\u4E48\u753B\u9762
- **\u7F6E\u9876\u4F5C\u54C1**\uFF1A\u7B49\u5185\u5BB9\u51FA\u6765\u540E\uFF0C\u4EC0\u4E48\u6837\u7684\u8BE5\u7F6E\u9876

## \u2705 \u81EA\u6D3D\u68C0\u9A8C
\u9010\u6761\u56DE\u7B54\u90A3\u4E09\u4E2A\u68C0\u9A8C\u95EE\u9898\uFF08\u906E\u5B57\u5E55\u3001\u53EA\u542C\u58F0\u97F3\u3001\u4E09\u4EF6\u5957\uFF09\u3002
**\u54EA\u4E00\u6761\u73B0\u5728\u4E0D\u8FC7\u5173\uFF0C\u76F4\u63A5\u8BF4\u51FA\u6765\u5E76\u7ED9\u8865\u6551\u65B9\u5411**\u2014\u2014\u4E0D\u8981\u7C89\u9970\u3002

## \u26A0\uFE0F \u8FD9\u4E2A\u53F7\u6700\u5927\u7684\u98CE\u9669
1-2 \u6761\u3002\u53EF\u80FD\u662F\u8D44\u6E90\u6491\u4E0D\u4F4F\u3001\u8D5B\u9053\u592A\u6324\u3001\u53D8\u73B0\u94FE\u8DEF\u65AD\uFF0C\u6216\u4EBA\u8BBE\u4E0D\u53EF\u6301\u7EED\u3002
\u8BF4\u5B9E\u8BDD\uFF0C\u4E0D\u8981\u53EA\u8BB2\u597D\u542C\u7684\u3002

---

\u26A0\uFE0F **\u5230\u8FD9\u91CC\u4E3A\u6B62\u3002** \u4E0D\u8981\u518D\u5199 30 \u5929\u8BA1\u5212\u3001\u53D1\u5E03\u6392\u671F\u3001\u6570\u636E\u8BCA\u65AD\u3001\u5177\u4F53\u9009\u9898\u6E05\u5355\u2014\u2014
\u90A3\u4E9B\u5C5E\u4E8E\u300C\u8D77\u53F7\u300D\u677F\u5757\uFF0C\u6709\u5B83\u81EA\u5DF1\u7684\u65B9\u6CD5\u8BBA\uFF08\u8D77\u53F736\u8BA1\u3001\u5F00\u7BC736\u8BA1\uFF09\u3002
\u8FD9\u4E00\u4EFD\u53EA\u89E3\u51B3"\u8FD9\u4E2A\u53F7\u662F\u4EC0\u4E48\u3001\u7ED9\u8C01\u3001\u51ED\u4EC0\u4E48"\uFF0C\u5199\u5230\u98CE\u9669\u5C31\u6536\u5C3E\u3002`;
var OUTPUT_BUSINESS = `## \u{1F4E4} \u8F93\u51FA\u683C\u5F0F

\u6309\u4E0B\u9762\u7684\u987A\u5E8F\u8F93\u51FA\uFF0C\u6807\u9898\u539F\u6837\u4FDD\u7559\u3002\u4E0D\u8981\u6709\u524D\u8A00\u3002

# \u{1F4B0} \u5546\u4E1A\u5B9A\u4F4D\u65B9\u6848

## \u{1F50D} \u5148\u8BF4\u8FD9\u4E00\u884C\u7684\u751F\u610F\u903B\u8F91
\u4E0D\u8981\u4ECE"\u4F60\u53EF\u4EE5\u5356\u4EC0\u4E48"\u8BB2\u8D77\uFF0C\u5148\u8BB2\u8FD9\u95E8\u751F\u610F\u672C\u8EAB\uFF1A\u6BDB\u5229\u5927\u6982\u4EC0\u4E48\u7ED3\u6784\u3001
\u9760\u5BA2\u5355\u8FD8\u662F\u9760\u590D\u8D2D\u3001\u83B7\u5BA2\u6210\u672C\u5361\u5728\u54EA\u3001\u5BA2\u4EBA\u51B3\u7B56\u8981\u591A\u4E45\u3001\u6709\u6CA1\u6709\u6DE1\u65FA\u5B63\u3002
**\u8FD9\u4E00\u8282\u5199\u7684\u662F\u6863\u6848\u91CC\u6CA1\u6709\u7684\u884C\u4E1A\u5E38\u8BC6**\uFF0C\u5168\u9760\u590D\u8FF0\u7528\u6237\u586B\u7684\u5185\u5BB9\u5C31\u767D\u5199\u4E86\u3002
\u4E0D\u786E\u5B9A\u7684\u6807\u660E"\u6211\u63A8\u6D4B\u2026\uFF0C\u5F85\u786E\u8BA4"\u3002

## \u53D8\u73B0\u5168\u666F
- **\u73B0\u5728\u80FD\u5356\u4EC0\u4E48**\uFF1A\u57FA\u4E8E\u5DF2\u6709\u8D44\u6E90\uFF0C\u5217\u51FA 2-4 \u4E2A\u53EF\u53D8\u73B0\u7684\u4EA7\u54C1\u6216\u670D\u52A1
- **\u5404\u81EA\u7684\u5BA2\u5355\u4EF7\u4E0E\u6BDB\u5229\u5927\u81F4\u533A\u95F4**
- **\u51B3\u7B56\u96BE\u5EA6**\uFF1A\u4F4E\u51B3\u7B56\uFF08\u770B\u5B8C\u5C31\u80FD\u4E70\uFF09\u8FD8\u662F\u9AD8\u51B3\u7B56\uFF08\u9700\u8981\u54A8\u8BE2\u3001\u5230\u5E97\u3001\u6BD4\u4EF7\uFF09

## \u4E3B\u63A8\u4EA7\u54C1
\u9009\u5B9A\u4E00\u4E2A\u4F5C\u4E3A\u4E3B\u63A8\uFF0C\u8BF4\u660E\u4E3A\u4EC0\u4E48\u662F\u5B83\uFF08\u8981\u7ED3\u5408\u4FE1\u4EFB\u95E8\u69DB\u548C\u751F\u4EA7\u80FD\u529B\uFF0C\u4E0D\u662F\u6311\u6700\u8D35\u7684\uFF09\u3002

## \u6210\u4EA4\u8DEF\u5F84
\u628A\u300C\u5237\u5230\u89C6\u9891\u300D\u5230\u300C\u4ED8\u94B1\u300D\u4E4B\u95F4\u7684\u6BCF\u4E00\u6B65\u62C6\u5F00\uFF1A
1. \u7B2C\u4E00\u6B21\u63A5\u89E6\u770B\u5230\u4EC0\u4E48
2. \u9760\u4EC0\u4E48\u4EA7\u751F\u5174\u8DA3
3. \u5728\u54EA\u91CC\u6C89\u6DC0\uFF08\u4E3B\u9875/\u79C1\u4FE1/\u5FAE\u4FE1/\u76F4\u64AD\u95F4/\u5230\u5E97\uFF09
4. \u4E34\u95E8\u4E00\u811A\u662F\u4EC0\u4E48
\u6BCF\u4E00\u6B65\u90FD\u8981\u8BF4\u660E\uFF1A\u8FD9\u4E00\u6B65\u4F1A\u6D41\u5931\u6389\u4EC0\u4E48\u4EBA\uFF0C\u4E3A\u4EC0\u4E48\u3002

## \u4FE1\u4EFB\u8BC1\u636E\u6E05\u5355
\u9AD8\u5BA2\u5355\u9760\u8BC1\u636E\u4E0D\u9760\u5F62\u5BB9\u8BCD\u3002\u5217\u51FA 5-8 \u6761**\u53EF\u4EE5\u62CD\u6210\u753B\u9762**\u7684\u8BC1\u636E\uFF0C
\u6807\u660E\u6BCF\u6761\u8BC1\u660E\u7684\u662F\u54EA\u79CD\u80FD\u529B\uFF08\u4E13\u4E1A/\u771F\u5B9E/\u7ED3\u679C/\u552E\u540E\uFF09\u3002
\u6CA1\u6709\u7684\u8BC1\u636E\u8981\u6807\u51FA\u6765\uFF0C\u5E76\u8BF4\u660E\u600E\u4E48\u6512\u3002

## \u53D8\u73B0\u578B\u5185\u5BB9\u600E\u4E48\u6392
- \u53D8\u73B0\u578B\u5185\u5BB9\u5360\u6BD4\u5EFA\u8BAE + \u7406\u7531
- 3-4 \u4E2A\u53D8\u73B0\u578B\u5185\u5BB9\u65B9\u5411\uFF0C\u6BCF\u4E2A\u8BF4\u660E\u5BF9\u5E94\u6210\u4EA4\u8DEF\u5F84\u7684\u54EA\u4E00\u6B65\u3001\u843D\u5728\u54EA\u4E2A\u6210\u4EA4\u7406\u7531\u4E0A\u3001\u7ED3\u5C3E\u53EA\u8981\u54EA\u4E00\u4E2A\u884C\u52A8\uFF0C
  **\u4E24\u79CD\u62CD\u6CD5\u90FD\u7ED9**\uFF1A\u56DB\u5927\u811A\u672C\u91CC\u7684\u54EA\u4E2A\u7ED3\u6784\uFF08\u6652\u8FC7\u7A0B\xB7\u706B\u8F66\u8282 / \u6559\u77E5\u8BC6\xB7\u89E3\u9898\u578B / \u6210\u529F\u6848\u4F8B\u2026\u2026\uFF09\uFF0C
  \u4EE5\u53CA\u6E05\u5355\u91CC\u54EA\u4E00\u8BA1\u3010\u53D8\u73B0\u578B\u3011\u7684\u8BA1\u80FD\u62CD\u5B83\uFF08\u5199\u6210"\u7B2CN\u8BA1\xB7\u8BA1\u540D\uFF1A\u5957\u5230\u8FD9\u4E2A\u53F7\u4E0A\u662F\u4EC0\u4E48\u4E8B\u4EF6"\uFF09
- **\u63D0\u9192**\uFF1A\u53D8\u73B0\u5185\u5BB9\u4E0D\u662F\u786C\u5E7F\u3002\u6BCF\u6761\u90FD\u8981\u5148\u7ED9\u4EF7\u503C\uFF0C\u518D\u8C08\u6210\u4EA4

## \u5B9A\u4EF7\u4E0E\u8282\u594F
- \u8D77\u6B65\u9636\u6BB5\u5EFA\u8BAE\u600E\u4E48\u5B9A\u4EF7\uFF08\u8981\u4E0D\u8981\u5F15\u6D41\u6B3E\uFF09
- \u4EC0\u4E48\u65F6\u5019\u53EF\u4EE5\u6DA8\u4EF7\u3001\u6DA8\u4EF7\u7684\u4F9D\u636E\u662F\u4EC0\u4E48

## \u26A0\uFE0F \u98CE\u9669
2-3 \u6761\u8FD9\u6761\u53D8\u73B0\u8DEF\u7EBF\u6700\u53EF\u80FD\u683D\u7684\u5730\u65B9\u3002`;
var OUTPUT_CONTENT = `## \u{1F4E4} \u8F93\u51FA\u683C\u5F0F

\u6309\u4E0B\u9762\u7684\u987A\u5E8F\u8F93\u51FA\uFF0C\u6807\u9898\u539F\u6837\u4FDD\u7559\u3002\u4E0D\u8981\u6709\u524D\u8A00\u3002

# \u{1F48E} \u5185\u5BB9\u5B9A\u4F4D\u65B9\u6848

## \u957F\u671F\u4EF7\u503C\u4E3B\u5F20
\u4E00\u53E5\u8BDD\uFF1A\u8FD9\u4E2A\u53F7\u957F\u671F\u7ED9\u89C2\u4F17\u63D0\u4F9B\u4EC0\u4E48\u3002\u4E0D\u8D85\u8FC725\u5B57\u3002

## \u5185\u5BB9\u65B9\u5411\uFF1A\u591A\u5143\u56DB\u7C7B\u8FD8\u662F\u5355\u4E00\u4E3B\u9898
\u6309\u300C\u5148\u5B9A\u5185\u5BB9\u65B9\u5411\u300D\u90A3\u4E00\u6BB5\u5224\u65AD\uFF1A
- **\u9009\u54EA\u6761**\uFF08A \u591A\u5143\u56DB\u7C7B / B \u5355\u4E00\u4E3B\u9898 / A \u6253\u5E95 + B \u738B\u724C\u680F\u76EE\uFF09\uFF0C\u4F9D\u636E\u662F\u4ED6\u7684\u771F\u5B9E\u7D20\u6750\u3001\u6267\u884C\u80FD\u529B\u3001\u548C\u53D8\u73B0\u8FDE\u4E0D\u8FDE\u5F97\u4E0A
- **\u4E3A\u4EC0\u4E48\u4E0D\u9009\u53E6\u4E00\u6761**
- \u9009\u4E86 B \u6216 A+B \u7684\uFF1A\u4E00\u53E5\u8BDD\u8BF4\u51FA\u90A3\u4E2A\u4E3B\u9898

## \u5185\u5BB9\u914D\u6BD4
\u4E25\u683C\u6309\u300C\u5185\u5BB9\u914D\u6BD4\u300D\u7684\u4E94\u6B65\u63A8\uFF0C**\u4E09\u5C42\u90FD\u8981\u7ED9**\uFF0C\u6BCF\u4E2A\u6570\u5B57\u90FD\u8BF4\u4E3A\u4EC0\u4E48\uFF0C\u4E0D\u662F\u5957\u6A21\u677F\uFF1A

### \u4F5C\u7528\u914D\u6BD4
| \u4F5C\u7528 | \u5360\u6BD4 | \u4E3A\u4EC0\u4E48 |
|---|---|---|
\uFF08\u6D41\u91CF\u578B / \u4EBA\u8BBE\u578B / \u53D8\u73B0\u578B\u3002\u770B\u9636\u6BB5\u548C\u7528\u6237\u76EE\u6807\u3002\u5199\u6E05\u695A**\u4EC0\u4E48\u6570\u636E\u51FA\u73B0\u65F6\u5207\u6362\u914D\u6BD4**\uFF09

### \u5F62\u5F0F\u914D\u6BD4
| \u5F62\u5F0F | \u5360\u6BD4 | \u8D1F\u8D23\u54EA\u79CD\u4F5C\u7528 | \u4E3A\u4EC0\u4E48 |
|---|---|---|---|
\uFF08\u77E5\u8BC6 / \u6545\u4E8B / \u6652\u8FC7\u7A0B / \u89C2\u70B9 / \u6BB5\u5B50\u3002\u4E3B\u529B\u5F62\u5F0F\u5C31\u662F\u6863\u6848\u91CC"\u6570\u636E\u6700\u597D\u7684\u5185\u5BB9\u7C7B\u578B"\uFF0C\u8981\u6362\u5FC5\u987B\u8BF4\u51FA\u5F88\u786C\u7684\u7406\u7531\uFF1B
\u53D8\u73B0\u578B\u90A3\u4E00\u5757\u7528\u4EC0\u4E48\u5F62\u5F0F\uFF0C\u6309\u5BA2\u4EBA\u4E3A\u4EC0\u4E48\u4E70\u4ED6\u6765\u5B9A\uFF09

### \u9898\u6750\u914D\u6BD4
- \u4E3B\u8D5B\u9053\u5360\u591A\u5C11\u3001\u76EE\u6807\u4EBA\u7FA4\u7684\u5174\u8DA3\u5360\u591A\u5C11
- **\u4EBA\u7FA4\u5174\u8DA3\u5177\u4F53\u662F\u54EA\u51E0\u7C7B**\uFF1A\u5199\u51FA\u8FD9\u7FA4\u4EBA\u9664\u4E86\u672C\u884C\u4E4B\u5916\u8FD8\u5173\u5FC3\u7684 2-3 \u4E2A\u8BDD\u9898

### \u914D\u6BD4\u6838\u9A8C
\u628A\u300C\u5185\u5BB9\u914D\u6BD4\u300D\u672B\u5C3E\u90A3\u4E94\u6761\u9010\u6761\u5199\u51FA\u7ED3\u679C\uFF08\u662F / \u5426 + \u4E00\u53E5\u8BDD\uFF09\uFF0C\u4E0D\u8981\u8DF3\u8FC7\u3002

## \u4E09\u79CD\u89C6\u9891\u600E\u4E48\u62CD
\u6309\u300C\u4E09\u79CD\u89C6\u9891\u300D\u90A3\u4E00\u6BB5\uFF0C\u7ED9\u8FD9\u4E2A\u53F7\u628A\u6D41\u91CF\u578B\u3001\u4EBA\u8BBE\u578B\u3001\u53D8\u73B0\u578B\u5404\u5199\u4E00\u904D\u3002**\u4E24\u5957\u6253\u6CD5\u90FD\u8981\u7ED9**
\uFF08\u6309\u300C\u4E24\u5957\u6253\u6CD5\u300D\u90A3\u4E00\u6BB5\uFF0C\u7528\u6237\u7528\u54EA\u5957\u662F\u4ED6\u81EA\u5DF1\u9009\uFF0C\u4E24\u9053\u83DC\u90FD\u5F97\u505A\u597D\uFF09\uFF1A
- **\u62CD\u4EC0\u4E48\u65B9\u5411**\uFF1A\u7ED9\u8FD9\u4E2A\u53F7\u7684 2 \u4E2A\u5177\u4F53\u65B9\u5411\uFF08\u4E0D\u662F\u7167\u6284\u901A\u7528\u8BF4\u660E\uFF09
- **\u56DB\u5927\u811A\u672C\uFF08\u859B\u8001\u5E08\uFF09**\uFF1A\u4ECE\u8FD9\u4E00\u79CD\u7684\u7ED3\u6784\u91CC\u6311 1-2 \u4E2A\u6700\u5408\u9002\u7684\uFF0C\u5199\u51FA\u9AA8\u67B6\u5957\u5230\u8FD9\u4E2A\u53F7\u4E0A\u662F\u4EC0\u4E48\u6837\uFF1B
  \u6807\u9898\u53EF\u4EE5\u53E0\u54EA\u4E2A\u7206\u6B3E\u5143\u7D20\u3002\u9644\u4E00\u6761\u793A\u8303\uFF1A\u80FD\u76F4\u63A5\u7528\u7684\u6807\u9898 + \u4E00\u53E5\u8BDD\u600E\u4E48\u62CD
- **\u8D77\u53F736\u8BA1\uFF08\u5C0F\u9EC4\uFF09**\uFF1A\u4ECE\u6E05\u5355\u91CC\u6807\u4E86\u8FD9\u4E00\u79CD\u7684\u8BA1\u4E2D\u6311 1-2 \u8BA1\u4ED6\u62CD\u5F97\u51FA\u6765\u7684\uFF0C\u6BCF\u8BA1\u5199\u6210
  "\u7B2CN\u8BA1\xB7\u8BA1\u540D\uFF1A\u516C\u5F0F\u5957\u5230\u8FD9\u4E2A\u53F7\u4E0A\u662F\u4EC0\u4E48\u4E8B\u4EF6"\u3002\u9644\u4E00\u6761\u793A\u8303\uFF1A\u80FD\u76F4\u63A5\u7528\u7684\u6807\u9898 + \u4E00\u53E5\u8BDD\u600E\u4E48\u62CD
- **\u7ED3\u5C3E\u884C\u52A8\u6307\u4EE4**\uFF1A\u53EA\u5199\u4E00\u4E2A\uFF08\u4E24\u5957\u6253\u6CD5\u5171\u7528\uFF09

## \u5185\u5BB9\u7CFB\u5217\uFF082-4 \u4E2A\uFF09
\u6BCF\u4E2A\u7CFB\u5217\u6309\u300C\u7CFB\u5217\u600E\u4E48\u8BBE\u8BA1\u300D\u6765\uFF0C\u5199\u6E05\uFF1A
- **\u7CFB\u5217\u540D + \u4E00\u53E5\u8BDD\u8BB2\u6E05**
- **\u5B9A\u91CF / \u53D8\u91CF**\uFF1A\u6BCF\u96C6\u4E0D\u53D8\u7684\u662F\u4EC0\u4E48\u3001\u6BCF\u96C6\u6362\u7684\u662F\u4EC0\u4E48
- **\u7528\u54EA\u5957\u6253\u6CD5**\uFF1A\u56DB\u5927\u811A\u672C\u7CFB\u5217\uFF08\u5B9A\u91CF\u662F\u56FA\u5B9A\u7684\u811A\u672C\u7ED3\u6784 / \u680F\u76EE\uFF09\uFF0C\u8FD8\u662F 36 \u8BA1\u7CFB\u5217\uFF08\u5B9A\u91CF\u662F\u67D0\u4E00\u8BA1\u7684\u516C\u5F0F\uFF0C
  \u5199\u660E"\u7B2CN\u8BA1\xB7\u8BA1\u540D"\uFF09\u30022-4 \u4E2A\u7CFB\u5217\u91CC**\u4E24\u5957\u81F3\u5C11\u5404\u6709\u4E00\u4E2A**
- **\u76EE\u7684\u548C\u7ED3\u6784**\uFF1A\u53EA\u62C5\u4E00\u4E2A\u4E3B\u76EE\u7684\uFF08\u6D41\u91CF / \u4EBA\u8BBE / \u53D8\u73B0\uFF09\uFF0C\u7528\u54EA\u79CD\u811A\u672C\u3001\u54EA\u4E2A\u7ED3\u6784
  \uFF08\u4ECE\u300C\u4E09\u79CD\u89C6\u9891\u300D\u91CC\u5BF9\u5E94\u90A3\u4E00\u79CD\u7684\u7ED3\u6784\u4E2D\u6311\uFF09\uFF0C\u6BCF\u96C6\u7ED3\u5C3E\u7684\u884C\u52A8\u6307\u4EE4\u662F\u4EC0\u4E48
- **\u8BA9\u89C2\u4F17\u53D1\u751F\u54EA\u79CD\u53D8\u5316**\uFF1A\u8BA4\u77E5 / \u60C5\u7EEA / \u884C\u52A8 / \u8EAB\u4EFD\u786E\u8BA4 / \u4FE1\u4EFB\uFF0C\u53EA\u9009\u4E00\u4E2A\u4E3B\u8981\u7684
- **\u524D 10 \u96C6\u6807\u9898**\uFF1A\u5217\u6EE1 10 \u4E2A\uFF0C\u80FD\u76F4\u63A5\u5F53\u9009\u9898\u7528\uFF1B\u53E0\u4E86\u7206\u6B3E\u5143\u7D20\u7684\u5728\u540E\u9762\u7528\u62EC\u53F7\u6807\u51FA\u662F\u54EA\u4E2A\u3002
  \u26A0\uFE0F **\u6807\u9898\u91CC\u6863\u6848\u6CA1\u5199\u8FC7\u7684\u6570\u5B57\u4E00\u5F8B\u5199 X**\uFF08\u5E74\u9F84\u3001\u5E74\u9650\u3001\u91D1\u989D\u3001\u4EBA\u6570\u3001\u64AD\u653E\u91CF\u90FD\u7B97\uFF09\uFF1A
  \u5199\u300A\u5E2EX\u5C81\u7684\u670D\u88C5\u5E97\u8001\u677F\u62CD\u7B2C\u4E00\u6761\u300B\uFF0C\u4E0D\u5199\u300A\u5E2E50\u5C81\u7684\u670D\u88C5\u5E97\u8001\u677F\u62CD\u7B2C\u4E00\u6761\u300B\u2014\u2014
  \u4ED6\u6CA1\u7ECF\u5386\u8FC7\u7684\u6570\uFF0C\u53D1\u51FA\u53BB\u5C31\u662F\u7F16\u7684
- **\u7ACB\u9879\u68C0\u9A8C**\uFF1A\u4E00\u53E5\u8BDD\u8BB2\u6E05 / \u6491\u5F97\u4F4F 30 \u96C6 / \u771F\u5B9E\u6027 / \u548C\u53D8\u73B0\u8FDE\u4E0A\uFF0C\u9010\u6761\u5199"\u8FC7"\u6216"\u4E0D\u8FC7 + \u539F\u56E0"
\u65B9\u5411\u9009\u4E86 B \u6216 A+B \u7684\uFF0C**\u7B2C\u4E00\u4E2A\u7CFB\u5217\u5C31\u662F\u90A3\u4E2A\u4E3B\u9898\u578B\u4E3B\u7CFB\u5217**\u3002\u5217\u4E0D\u6EE1 10 \u96C6\u3001\u6216\u8005\u7ACB\u9879\u68C0\u9A8C\u6CA1\u8FC7\u7684\u7CFB\u5217\uFF0C\u4E0D\u8981\u5199\u8FDB\u6765\u3002

## \u9009\u9898\u6765\u6E90
\u6309\u300C\u9009\u9898\u4ECE\u54EA\u6765\u300D\u7684\u56DB\u5927\u65B9\u5411\uFF0C\u6BCF\u4E2A\u65B9\u5411\u7ED9\u8FD9\u4E2A\u53F7 1-2 \u4E2A**\u80FD\u957F\u671F\u6316**\u7684\u5177\u4F53\u6765\u6E90\uFF0C\u5404\u4E3E\u4E00\u4E2A\u4F8B\u5B50\u3002
\u6700\u540E\u7ED9\u4E00\u4E2A\u4E5D\u5BAB\u683C\u793A\u4F8B\uFF1A\u884C\u4E1A\u5173\u952E\u8BCD 3 \u4E2A \xD7 \u4EBA\u7FA4\u5173\u5FC3\u7684\u5173\u952E\u8BCD 3 \u4E2A\uFF0C\u8FDE\u51FA 3 \u4E2A\u9009\u9898\u3002

## \u524D 30 \u6761\u8282\u594F
\u6309\u65B0\u53F7\u7B56\u7565\uFF1A\u524D 20-30 \u6761\u5148\u7528\u4E3B\u529B\u5F62\u5F0F\uFF08\u6216\u4E3B\u7CFB\u5217\uFF09\u96C6\u4E2D\u8DD1\u901A\uFF0C\u518D\u9010\u6B65\u8865\u5176\u4ED6\u7C7B\u578B\u3002
- \u7B2C 1-10 \u6761 / \u7B2C 11-20 \u6761 / \u7B2C 21-30 \u6761\uFF1A\u5404\u81EA\u7684\u76EE\u6807\u3001\u505A\u54EA\u4E2A\u7CFB\u5217\u3001\u52A0\u4EC0\u4E48\u3001
  **\u4E3B\u8981\u7528\u54EA\u5957\u6253\u6CD5**\uFF08\u8D77\u53F7\u671F 36 \u8BA1\u662F\u62FF\u6D41\u91CF\u7684\u4E3B\u529B\uFF0C\u56DB\u5927\u811A\u672C\u8D1F\u8D23\u8865\u4EBA\u8BBE\u548C\u6210\u4EA4\u7406\u7531\uFF1B\u5199\u51FA\u5177\u4F53\u7528\u54EA\u51E0\u8BA1\uFF09
- \u6BCF\u4E2A\u9636\u6BB5\u7684\u9A8C\u6536\u6807\u51C6\uFF1A\u770B\u4EC0\u4E48\u6570\u636E\u7B97\u8FC7\u5173
\u53EA\u7ED9\u65B9\u5411\u548C\u8282\u594F\uFF0C\u4E0D\u6392\u5177\u4F53\u65E5\u671F\u2014\u2014\u6392\u671F\u548C\u6253\u6CD5\u662F\u300C\u8D77\u53F7\u300D\u677F\u5757\u7684\u4E8B\u3002

## \u26A0\uFE0F \u4E0D\u8981\u505A\u4EC0\u4E48
3 \u6761\u8FD9\u4E2A\u53F7\u660E\u786E**\u4E0D\u8BE5\u78B0**\u7684\u5185\u5BB9\u65B9\u5411\uFF0C\u8BF4\u660E\u4E3A\u4EC0\u4E48\uFF08\u8DD1\u504F\u4EBA\u8BBE\u3001\u62C9\u4F4E\u7CBE\u51C6\u5EA6\u3001\u751F\u4EA7\u4E0D\u53EF\u6301\u7EED\uFF09\u3002

---

**\u4EA4\u7A3F\u524D\u81EA\u67E5**\uFF08\u8FD9\u51E0\u6761\u5B9E\u6D4B\u6700\u5BB9\u6613\u6F0F\uFF0C\u4E0D\u8FC7\u5173\u5C31\u6539\u5B8C\u518D\u4EA4\uFF0C\u81EA\u67E5\u8FC7\u7A0B\u4E0D\u7528\u5199\u51FA\u6765\uFF09\uFF1A
1. \u6240\u6709\u5341\u96C6\u6807\u9898\u91CC\uFF0C\u6863\u6848\u6CA1\u5199\u8FC7\u7684\u6570\u5B57\u90FD\u6362\u6210\u4E86 X
2. \u5168\u6587\u6CA1\u6709\u51FA\u73B0"\u63ED\u79D8"\u4E24\u4E2A\u5B57\uFF08\u8BF4"\u62C6\u89E3""\u5E26\u4F60\u770B\u61C2"\uFF09
3. \u4F8B\u5B50\u91CC\u6CA1\u6709\u628A\u54EA\u4E2A\u8001\u677F\u3001\u5BA2\u6237\u3001\u540C\u884C\u5199\u6210\u53CD\u9762\u89D2\u8272`;
function restrictionSection(restrictions) {
  const rows = [
    restrictions?.trim() ? `- **\u8FD9\u4E2A\u8D26\u53F7\u660E\u786E\u4E0D\u80FD\u8BF4**\uFF1A${restrictions.trim()}` : "",
    '- \u4E0D\u8981\u4F7F\u7528"\u63ED\u79D8"\u4E8C\u5B57\uFF08\u5BB9\u6613\u62DB\u540C\u884C\u4E3E\u62A5\u548C\u8BCB\u6BC1\uFF09\uFF0C\u6539\u8BF4"\u6559\u4F60\u770B\u61C2""\u5E26\u4F60\u4E86\u89E3""\u5BF9\u6BD4\u5206\u6790"',
    "- \u4E0D\u8981\u51FA\u73B0\u7EDD\u5BF9\u5316\u7528\u8BED\uFF1A\u6700\u597D\u3001\u7B2C\u4E00\u3001\u5168\u7F51\u6700\u4FBF\u5B9C\u3001100%",
    "- \u4E0D\u8981\u7ED9\u51FA\u9700\u8981\u4F2A\u9020\u3001\u6446\u62CD\u6210\u771F\u5B9E\u7684\u5EFA\u8BAE",
    // 实测：禁忌写着"不诋毁老板"，示范的第一条视频却是"老板拿了效果不给钱"，
    // 还替用户编了"三条视频带来47个客人"当他的亲身经历
    "- **\u4EE5\u4E0A\u7981\u5FCC\u540C\u6837\u7BA1\u4F60\u4E3E\u7684\u4F8B\u5B50\u3001\u793A\u8303\u6807\u9898\u548C\u811A\u672C**\u2014\u2014\u4F8B\u5B50\u91CC\u4E5F\u4E0D\u80FD\u51FA\u73B0\u8BCB\u6BC1\u3001\u63ED\u79D8\u3001\u7EDD\u5BF9\u5316\uFF1B",
    "  \u4F8B\u5B50\u91CC\u7684\u8001\u677F\u3001\u5BA2\u6237\u3001\u540C\u884C\u4E5F\u4E0D\u80FD\u88AB\u5199\u6210\u53CD\u9762\u89D2\u8272\uFF08\u8D56\u8D26\u3001\u5751\u4EBA\u3001\u96BE\u7F20\uFF09\uFF0C\u90A3\u540C\u6837\u662F\u5728\u8BCB\u6BC1",
    /*
     * 实测"标明示例"压不住：内容定位的十集清单里照样写出"帮20个老板改过""47个到店客人"
     * 这种用户从没说过的数。改成占位——X 一眼就知道要自己填，也不会被当成真事发出去。
     */
    "- **\u4E0D\u8981\u66FF\u7528\u6237\u7F16\u6570\u5B57\u548C\u7ECF\u5386**\uFF1A\u6863\u6848\u91CC\u6CA1\u6709\u7684\u4EBA\u6570\u3001\u91D1\u989D\u3001\u5E74\u9650\u3001\u64AD\u653E\u91CF\u4E00\u5F8B\u5199\u6210 X\uFF08\u5982\u300A\u5E2EX\u4E2A\u8001\u677F\u62CD\u4E86\u7B2C\u4E00\u6761\u300B\uFF09\uFF1B",
    // 实测：上一份定位里示范用的"86播放、5000播放"，被内容定位当成真实数据照抄进了系列标题
    "  \u4E4B\u524D\u505A\u8FC7\u7684\u5B9A\u4F4D\u65B9\u6848\u91CC\u793A\u8303\u7528\u7684\u64AD\u653E\u91CF\u3001\u4EBA\u6570\u3001\u5E74\u9650\u4E5F\u662F\u5F53\u65F6\u4E3E\u7684\u4F8B\u5B50\uFF0C**\u4E0D\u7B97\u4ED6\u7684\u771F\u5B9E\u6570\u636E**\uFF0C\u540C\u6837\u5199 X\uFF1B",
    '  \u6863\u6848\u91CC\u6CA1\u5199\u8FC7\u7684\u5177\u4F53\u7ECF\u5386\uFF0C\u5199\u6210\u4ED6\u80FD\u7167\u7740\u586B\u7684\u6837\u5B50\uFF0C\u5E76\u5728\u540E\u9762\u6807"\uFF08\u793A\u4F8B\uFF0C\u6362\u6210\u4F60\u81EA\u5DF1\u7684\u771F\u5B9E\u7ECF\u5386\uFF09"'
  ].filter(Boolean);
  return `### \u26D4 \u786C\u6027\u7981\u5FCC\uFF08\u8FDD\u53CD\u5373\u4E0D\u53EF\u7528\uFF09

${rows.join("\n")}`;
}
function businessLinesSection(profileSummary) {
  const items = businessLineItems(profileSummary);
  if (items.length === 0) return "";
  return `### \u{1F37D} \u7ECF\u8425\u54C1\u7C7B\uFF08\u786C\u7EA6\u675F\uFF09

\u8FD9\u5BB6\u5E97\u5728\u5356\uFF1A**${items.join("\u3001")}**\u3002\u6BCF\u4E00\u4E2A\u90FD\u5728\u5356\u3001\u540C\u7B49\u91CD\u8981\uFF1A
- **\u4E00\u53E5\u8BDD\u5B9A\u4F4D\u3001\u4E3B\u6253\u5185\u5BB9\u91CC\u8981\u628A\u8FD9\u51E0\u4E2A\u54C1\u7C7B\u5E76\u5217\u5199\u5168**\uFF0C\u4E00\u4E2A\u90FD\u4E0D\u80FD\u5C11\uFF1B\u5185\u5BB9\u914D\u6BD4\u91CC\u6BCF\u4E2A\u54C1\u7C7B\u90FD\u8981\u6709\u4F4D\u7F6E
- \u4E0D\u8981\u53EA\u6311\u5176\u4E2D\u51E0\u4E2A\u5F53"\u4E3B\u6253"\uFF0C\u4E5F\u4E0D\u8981\u628A\u54EA\u4E2A\u964D\u6210"\u914D\u89D2""\u5F15\u6D41\u6B3E"
- \u53A8\u5E08\u7ECF\u9A8C\u3001\u624B\u827A\u662F\u4EBA\u8BBE\u80CC\u4E66\uFF0C**\u4E0D\u80FD\u62FF\u5B83\u9876\u66FF\u4E00\u4E2A\u54C1\u7C7B**\uFF08\u5199"\xD7\xD7\u53A8\u5B50"\u4E0D\u7B49\u4E8E\u5199\u4E86"\xD7\xD7"\u8FD9\u4E2A\u54C1\u7C7B\uFF09
- \u4EA4\u7A3F\u524D\u5BF9\u4E00\u904D\uFF1A\u4E00\u53E5\u8BDD\u5B9A\u4F4D\u91CC\uFF0C\u4E0A\u9762\u6BCF\u4E2A\u54C1\u7C7B\u662F\u4E0D\u662F\u90FD\u539F\u6837\u51FA\u73B0\u4E86`;
}
function buildPositioningPrompt(p) {
  const focus = p.focus ?? "full";
  const parts = [];
  const role = focus === "business" ? "\u4F60\u662F\u4E00\u4F4D\u505A\u5B9E\u4F53\u5E97\u77ED\u89C6\u9891\u4EE3\u8FD0\u8425\u7684\u64CD\u76D8\u624B\uFF0C\u4E13\u95E8\u8D1F\u8D23\u628A\u95E8\u5E97\u7684\u53D8\u73B0\u8DEF\u5F84\u62C6\u901A\u3002" : focus === "content" ? "\u4F60\u662F\u4E00\u4F4D\u505A\u5B9E\u4F53\u5E97\u77ED\u89C6\u9891\u4EE3\u8FD0\u8425\u7684\u4E3B\u7F16\uFF0C\u8D1F\u8D23\u7ED9\u63A5\u624B\u7684\u8D26\u53F7\u6392\u5185\u5BB9\u7ED3\u6784\u3002" : "\u4F60\u662F\u4E00\u4F4D\u505A\u5B9E\u4F53\u5E97\u77ED\u89C6\u9891\u4EE3\u8FD0\u8425\u7684\u8D44\u6DF1\u7F16\u5BFC\uFF0C\u5E26\u8FC7\u4E0A\u767E\u4E2A\u672C\u5730\u5546\u5BB6\u4ECE 0 \u8D77\u53F7\u3002";
  parts.push(`${role}

**\u4F60\u4E0D\u662F\u5728\u586B\u8868**\u3002\u4E0B\u9762\u7ED9\u4E86\u4E00\u6574\u5957\u5224\u65AD\u4F9D\u636E\uFF0C\u4F60\u8981\u7528\u5B83\u4EEC\u505A\u5224\u65AD\u3001\u7ED9\u51FA\u6709\u7406\u6709\u636E\u7684\u7ED3\u8BBA\uFF0C
\u5E76\u4E14\u6BCF\u4E00\u4E2A\u7ED3\u8BBA\u90FD\u8981\u8BF4\u6E05"\u4E3A\u4EC0\u4E48\u662F\u8FD9\u4E2A"\u3002\u53EA\u628A\u5C0F\u8282\u586B\u6EE1\u3001\u8BF4\u4E00\u5806\u6B63\u786E\u7684\u5E9F\u8BDD\uFF0C\u7B49\u4E8E\u6CA1\u505A\u3002`);
  parts.push("");
  parts.push("## \u{1F4CB} \u8FD9\u4E2A\u8D26\u53F7\u7684\u60C5\u51B5");
  parts.push("");
  parts.push(p.profileSummary.trim());
  const products = businessLinesSection(p.profileSummary);
  if (products) {
    parts.push("");
    parts.push(products);
  }
  if (p.additionalNotes?.trim()) {
    parts.push("");
    parts.push("## \u{1F3AF} \u7528\u6237\u81EA\u5DF1\u5B9A\u7684\u65B9\u5411\uFF08\u786C\u7EA6\u675F\uFF09");
    parts.push("");
    parts.push(p.additionalNotes.trim());
    parts.push("");
    parts.push("\u8FD9\u662F\u7528\u6237\u5BF9\u8FD9\u4E2A\u53F7\u7684**\u76EE\u6807\u548C\u6838\u5FC3\u5B9A\u4F4D**\uFF0C\u4F18\u5148\u4E8E\u4E0A\u9762\u7684\u6863\u6848\uFF0C\u4E5F\u4F18\u5148\u4E8E\u4E0B\u9762\u65B9\u6CD5\u8BBA\u91CC\u7684\u9ED8\u8BA4\u503C\uFF1A");
    parts.push("- **\u4E3B\u4F53\u5224\u65AD\u3001\u4E00\u53E5\u8BDD\u5B9A\u4F4D\u3001\u4EBA\u8BBE**\u8981\u843D\u5728\u8FD9\u4E2A\u65B9\u5411\u4E0A\u3002\u4ED6\u81EA\u5DF1\u5199\u4E86\u6838\u5FC3\u5B9A\u4F4D\u7684\uFF0C\u5728\u5B83\u57FA\u7840\u4E0A\u6253\u78E8\uFF0C\u4E0D\u8981\u6362\u6210\u53E6\u4E00\u53E5");
    parts.push("- **\u5185\u5BB9\u914D\u6BD4**\u8981\u670D\u52A1\u8FD9\u4E2A\u76EE\u6807\uFF08\u6BD4\u5982\u4ED6\u8981\u5927\u6D41\u91CF\uFF0C\u6D41\u91CF\u578B\u5C31\u4E0D\u80FD\u662F\u5C0F\u5934\uFF09");
    parts.push("- \u4F60\u8BA4\u4E3A\u8FD9\u4E2A\u65B9\u5411\u6709\u98CE\u9669\uFF0C\u7167\u6837\u6309\u5B83\u505A\uFF0C\u518D\u7528\u4E00\u4E24\u53E5\u8BDD\u8BF4\u6E05\u4EE3\u4EF7\u548C\u600E\u4E48\u89C4\u907F\u2014\u2014\u4E0D\u8981\u81EA\u4F5C\u4E3B\u5F20\u6539\u65B9\u5411");
  }
  if (p.mixBlock?.trim()) {
    parts.push("");
    parts.push(p.mixBlock.trim());
    parts.push("- \u4E0B\u9762\u300C\u5185\u5BB9\u914D\u6BD4\u300D\u4E94\u6B65\u91CC\u7684**\u7B2C\u4E00\u6B65\u3001\u7B2C\u4E8C\u6B65\uFF08\u5B9A\u4F5C\u7528\u914D\u6BD4\uFF09\u5DF2\u7ECF\u5B9A\u597D**\uFF0C\u76F4\u63A5\u5199\u8FD9\u4E2A\u6570\u5E76\u89E3\u91CA\u4E3A\u4EC0\u4E48\u9002\u5408\uFF1B\u4ECE\u7B2C\u4E09\u6B65\uFF08\u4E3B\u529B\u5F62\u5F0F\uFF09\u5F80\u4E0B\u7167\u5E38\u63A8");
  }
  parts.push("");
  if (p.baseline?.trim()) {
    parts.push("## \u{1F9F1} \u5DF2\u786E\u5B9A\u7684\u5B9A\u4F4D\u5730\u57FA");
    parts.push("");
    parts.push(p.baseline.trim());
    parts.push("");
    parts.push("\u26A0\uFE0F \u4EE5\u4E0A\u662F\u8FD9\u4E2A\u53F7\u5DF2\u7ECF\u5B9A\u597D\u7684\u65B9\u5411\u3002\u4F60\u8FD9\u6B21\u53EA\u505A\u5176\u4E2D\u4E00\u7EF4\u7684\u6DF1\u6316\uFF0C**\u5FC5\u987B\u4E0E\u5B83\u4E00\u81F4**\uFF0C");
    parts.push("\u4E0D\u8981\u53E6\u8D77\u7089\u7076\u3002\u5982\u679C\u4F60\u8BA4\u4E3A\u5730\u57FA\u91CC\u6709\u660E\u663E\u95EE\u9898\uFF0C\u5148\u7528\u4E00\u53E5\u8BDD\u6307\u51FA\u6765\uFF0C\u518D\u6309\u5B83\u5F80\u4E0B\u505A\u3002");
    parts.push("");
  }
  parts.push(AGENCY_STANCE);
  parts.push("");
  parts.push("## \u{1F4DA} \u5224\u65AD\u4F9D\u636E");
  parts.push("");
  parts.push(INDUSTRY_LENS);
  parts.push("");
  parts.push(AUDIENCE_CHANGE);
  parts.push("");
  parts.push(THREE_PRINCIPLES);
  parts.push("");
  parts.push(rolesGuide());
  parts.push("");
  parts.push(ROUTES_GUIDE);
  parts.push("");
  parts.push(
    tacticIndex({
      roles: focus === "business" ? ["\u53D8\u73B0\u578B"] : void 0,
      exclude: tacticsBlockedBy([p.restrictions, p.taboos].filter(Boolean).join("\n"))
    })
  );
  parts.push("");
  if (focus === "full") {
    parts.push(SIX_DIMENSIONS);
    parts.push("");
    parts.push(PERSONA_ENTRIES);
    parts.push("");
    parts.push(CONTENT_DIRECTION);
    parts.push("");
    parts.push(CONTENT_MIX);
    parts.push("");
    parts.push(MEMORY_HOOKS);
    parts.push("");
    parts.push(DIFFERENTIATION);
    parts.push("");
    parts.push(ECONOMY_MODELS);
    parts.push("");
    parts.push(COHERENCE_CHECK);
  } else if (focus === "content") {
    parts.push(CONTENT_DIRECTION);
    parts.push("");
    parts.push(CONTENT_MIX);
    parts.push("");
    parts.push(SERIES_DESIGN);
    parts.push("");
    parts.push(TOPIC_SOURCES);
    parts.push("");
    parts.push(PRESENTATION_FORMS);
    parts.push("");
    parts.push(DIFFERENTIATION);
    parts.push("");
    parts.push(COHERENCE_CHECK);
  } else {
    parts.push(ECONOMY_MODELS);
    parts.push("");
    parts.push(CONTENT_MIX);
    parts.push("");
    parts.push(DIAGNOSIS_TREE);
  }
  parts.push("");
  parts.push(platformSection(p.platform));
  parts.push("");
  parts.push(restrictionSection(p.restrictions));
  parts.push("");
  if (p.taboos?.trim()) {
    parts.push(p.taboos.trim());
    parts.push("- \u4EE5\u4E0A\u540C\u6837\u7BA1\u5B9A\u4F4D\u91CC\u7684\u4E3B\u6253\u5185\u5BB9\u3001\u5185\u5BB9\u7CFB\u5217\u3001\u9009\u9898\u793A\u4F8B\u548C\u793A\u8303\u6807\u9898");
    parts.push("");
  }
  parts.push(
    p.outputSpec?.trim() ? p.outputSpec.trim() : focus === "business" ? OUTPUT_BUSINESS : focus === "content" ? OUTPUT_CONTENT : OUTPUT_FULL
  );
  parts.push("");
  parts.push(`## \u270D\uFE0F \u5199\u4F5C\u8981\u6C42

- **\u63A7\u5236\u7BC7\u5E45**\uFF1A\u4EBA\u8BBE\u3001\u7528\u6237\u3001\u5185\u5BB9\u8FD9\u4E09\u7EF4\u8981\u5199\u900F\uFF0C**\u5176\u4F59\u4E09\u7EF4\u53EA\u7ED9\u7ED3\u8BBA**\u3002
  \u6574\u4EFD\u63A7\u5236\u5728 8000 \u5B57\u4EE5\u5185\u2014\u2014\u5199\u5F97\u518D\u591A\uFF0C\u770B\u7684\u4EBA\u7FFB\u4E0D\u5B8C\u4E5F\u662F\u767D\u5199
- **\u8981\u6269\u6563\uFF0C\u4E0D\u8981\u590D\u8FF0**\uFF1A\u6863\u6848\u91CC\u5199\u4E86\u4EC0\u4E48\u4E0D\u5FC5\u518D\u8BF4\u4E00\u904D\uFF0C\u7528\u6237\u81EA\u5DF1\u586B\u7684\u4ED6\u77E5\u9053\u3002
  \u4F60\u7684\u4EF7\u503C\u5728\u4E8E\u8BF4\u51FA**\u4ED6\u6CA1\u5199\u3001\u4F46\u4E00\u770B\u5C31\u4F1A\u70B9\u5934**\u7684\u4E1C\u897F\u2014\u2014\u8FD9\u4E00\u884C\u7684\u89C4\u5F8B\u3001
  \u4ED6\u81EA\u5DF1\u6CA1\u610F\u8BC6\u5230\u7684\u4F18\u52BF\u3001\u540C\u884C\u8E29\u8FC7\u7684\u5751\u3002\u5168\u7BC7\u590D\u8FF0\u6863\u6848 = \u8FD9\u4EFD\u65B9\u6848\u6CA1\u6709\u4EF7\u503C
- **\u63A8\u6D4B\u5C31\u6807\u660E\u63A8\u6D4B**\uFF1A\u4E0D\u786E\u5B9A\u7684\u5730\u65B9\u5199"\u6211\u63A8\u6D4B\u2026\uFF0C\u5F85\u786E\u8BA4"\uFF0C\u7136\u540E\u7167\u6837\u5F80\u4E0B\u63A8\u3002
  \u4E0D\u6562\u8BF4\u624D\u662F\u771F\u6CA1\u7528\uFF1B\u8BF4\u9519\u4E86\u5BA2\u6237\u7EA0\u6B63\u4E00\u53E5\u5C31\u884C
- **\u6709\u4F9D\u636E**\uFF1A\u6BCF\u4E2A\u7ED3\u8BBA\u540E\u9762\u90FD\u8981\u80FD\u8BF4\u51FA\u4E3A\u4EC0\u4E48\u3002\u8BF4\u4E0D\u51FA\u7406\u7531\u7684\u7ED3\u8BBA\u76F4\u63A5\u5220\u6389
- **\u53EF\u843D\u5730**\uFF1A\u6240\u6709\u5EFA\u8BAE\u5FC5\u987B\u5728\u8FD9\u4E2A\u8D26\u53F7\u7684\u771F\u5B9E\u8D44\u6E90\uFF08\u8BBE\u5907\u3001\u56E2\u961F\u3001\u573A\u5730\u3001\u65F6\u95F4\uFF09\u4E4B\u5185
- **\u5177\u4F53**\uFF1A\u4E0D\u8981\u5199"\u6253\u9020\u4E13\u4E1A\u5F62\u8C61""\u63D0\u5347\u7528\u6237\u7C98\u6027"\u8FD9\u7C7B\u4EFB\u4F55\u8D26\u53F7\u90FD\u80FD\u5957\u7684\u8BDD
- **\u6562\u8BF4\u4E0D**\uFF1A\u6863\u6848\u91CC\u6709\u660E\u663E\u4E0D\u9002\u5408\u7684\u5730\u65B9\uFF08\u6BD4\u5982\u8D44\u6E90\u6491\u4E0D\u8D77\u60F3\u505A\u7684\u5F62\u5F0F\uFF09\uFF0C\u76F4\u63A5\u6307\u51FA\u6765
- **\u6BCF\u4E00\u8282\u90FD\u8981\u5199\u591F**\uFF1A\u540E\u9762\u7684\u7AE0\u8282\u548C\u524D\u9762\u4E00\u6837\u91CD\u8981\uFF0C\u4E0D\u8981\u8D8A\u5199\u8D8A\u7B80\u7565\u3002
  \u8BB0\u5FC6\u70B9\u3001\u5DEE\u5F02\u5316\u300130\u5929\u5B9E\u9A8C\u3001\u8BCA\u65AD\u6811\u8FD9\u51E0\u8282\u6700\u5BB9\u6613\u88AB\u6577\u884D\uFF0C\u6070\u6070\u662F\u6700\u80FD\u843D\u5730\u7684\u90E8\u5206
- **\u4E0D\u8981\u7F57\u5217\u6211\u7ED9\u4F60\u7684\u8868\u683C**\uFF1A\u4E0A\u9762\u90A3\u4E9B\u8868\u662F\u7ED9\u4F60\u505A\u5224\u65AD\u7528\u7684\u53C2\u8003\uFF0C
  \u4E0D\u8981\u539F\u6837\u6284\u8FDB\u65B9\u6848\u91CC\uFF1B\u8981\u8F93\u51FA\u7684\u662F**\u9488\u5BF9\u8FD9\u4E2A\u8D26\u53F7\u7684\u5177\u4F53\u7ED3\u8BBA**
- \u7BC7\u5E45\u6309\u9700\u8981\u6765\uFF0C\u4E0D\u8981\u4E3A\u4E86\u51D1\u5B57\u6570\u704C\u6C34\uFF0C\u4E5F\u4E0D\u8981\u4E3A\u4E86\u7B80\u77ED\u727A\u7272\u5224\u65AD\u8FC7\u7A0B`);
  const finalCheck = businessLinesFinalCheck(p.profileSummary);
  if (finalCheck) {
    parts.push("");
    parts.push(finalCheck);
  }
  return parts.join("\n");
}
function businessLinesFinalCheck(profileSummary) {
  const items = businessLineItems(profileSummary);
  if (items.length === 0) return "";
  return `## \u2705 \u4EA4\u7A3F\u524D\u6700\u540E\u68C0\u67E5\uFF1A\u7ECF\u8425\u54C1\u7C7B\uFF08\u4E0D\u8FC7\u5173\u5C31\u6539\u5B8C\u518D\u4EA4\uFF09

\u8FD9\u5BB6\u5E97\u5728\u5356 ${items.length} \u4E2A\u54C1\u7C7B\uFF1A${items.map((x) => `\u300C${x}\u300D`).join("")}\u3002
- **\u4E00\u53E5\u8BDD\u5B9A\u4F4D\u91CC\uFF0C\u8FD9 ${items.length} \u4E2A\u8BCD\u8981\u539F\u6837\u51FA\u73B0\u3001\u4E00\u5B57\u4E0D\u5DEE**\u2014\u2014\u4E0D\u80FD\u5408\u5E76\u6210\u4E00\u4E2A\u7EDF\u79F0\uFF08"\u5DDD\u5473\u9986""\u4E00\u9505\u7AEF"\u4E0D\u7B97\uFF09\uFF0C\u4E5F\u4E0D\u80FD\u62C6\u5F00\u91CD\u7EC4
- **"\xD7\xD7\u5E08\u5085""\xD7\xD7\u53A8\u5B50"\u4E0D\u7B97\u5199\u4E86"\xD7\xD7"\u8FD9\u4E2A\u54C1\u7C7B**\uFF1A\u90A3\u662F\u4EBA\u8BBE\uFF0C\u54C1\u7C7B\u8981\u5355\u72EC\u5199\u51FA\u6765
- \u4E3B\u6253\u5185\u5BB9\u3001\u5185\u5BB9\u914D\u6BD4\u91CC\uFF0C\u4E5F\u8981\u9010\u4E2A\u5199\u51FA\u8FD9 ${items.length} \u4E2A\u54C1\u7C7B`;
}
function businessLineItems(profileSummary) {
  const line2 = profileSummary.split("\n").find((l) => l.startsWith(BUSINESS_LINES_LABEL));
  return (line2?.slice(BUSINESS_LINES_LABEL.length) ?? "").split("\u3001").map((x) => x.trim()).filter(Boolean);
}
var POSITIONING_REFS = {
  stance: AGENCY_STANCE,
  industry: INDUSTRY_LENS,
  audienceChange: AUDIENCE_CHANGE,
  principles: THREE_PRINCIPLES,
  sixDim: SIX_DIMENSIONS,
  persona: PERSONA_ENTRIES,
  contentMix: CONTENT_MIX,
  // 三种视频各怎么拍——重写「内容定位」一节时，配比和打法都得按这份来
  roles: rolesGuide(),
  // 两套打法 + 36 计清单（带公式）——重写内容定位时两套都要给
  routes: `${ROUTES_GUIDE}

${tacticIndex()}`,
  series: SERIES_DESIGN,
  presentation: PRESENTATION_FORMS,
  tone: TONE_TOUCHPOINTS,
  memory: MEMORY_HOOKS,
  diff: DIFFERENTIATION,
  economy: ECONOMY_MODELS,
  coherence: COHERENCE_CHECK
};

// .tmp/content-audit-production_20261008/lib/creative-craft.ts
function creativeCraftRules(p) {
  const root = p.intent?.trim() || p.context?.match(/^- 原始用户想法：([^\n]+)/m)?.[1]?.trim();
  const material = [root || p.source, p.selected].filter(Boolean).join("\n");
  const interview = !/不(?:要)?(?:做)?(?:采访|街采|街访)/.test(material) && /采访|访谈|街访|问.{0,8}(?:老板|店主|商家)|(?:老板|店主).{0,8}(?:真实感受|真实反应)/.test(material);
  const comparison = /前后|前.{0,12}后|对比|比较/.test(material);
  const rules = [
    "\u3010\u672C\u8F6E\u5185\u5BB9\u843D\u5B9E\u89C4\u5219\u3011",
    "- \u539F\u59CB\u7528\u6237\u60F3\u6CD5\u53CA\u672C\u8F6E\u660E\u786E\u4FEE\u6539\u51B3\u5B9A\u76EE\u7684\u3001\u4E3B\u4F53\u3001\u6BD4\u8F83\u5BF9\u8C61\u3001\u65F6\u95F4\u8303\u56F4\u548C\u53D6\u6750\u65B9\u5F0F\u3002\u5DF2\u6709 AI \u7A3F\u53EA\u4F5C\u5F85\u6838\u5BF9\u8349\u7A3F\uFF0C\u4E0D\u80FD\u628A\u5176\u4E2D\u793A\u8303\u60C5\u8282\u3001\u5047\u5B9A\u56DE\u7B54\u6216\u63A8\u65AD\u5F53\u4F5C\u65B0\u589E\u771F\u5B9E\u7D20\u6750\u3002",
    "- \u5148\u5B8C\u6210\u5F53\u524D\u8FD9\u6761\u5185\u5BB9\uFF1B\u6DF1\u5316\u6765\u81EA\u5177\u4F53\u95EE\u9898\u3001\u8BC1\u636E\u3001\u52A8\u4F5C\u53CA\u4FE1\u606F\u5173\u7CFB\uFF0C\u4E0D\u80FD\u56E0\u8FFD\u6C42\u6D41\u91CF\u5148\u6362\u8282\u76EE\u3001\u7B49\u6DA8\u7C89\u540E\u518D\u5151\u73B0\u672C\u6765\u7684\u4EFB\u52A1\u3002\u65B9\u6CD5\u5E93\u7528\u4E8E\u89E3\u51B3\u95EE\u9898\uFF0C\u4E0D\u7528\u4E8E\u8865\u9020\u51B2\u7A81\u3001\u7ED3\u679C\u6216\u60C5\u7EEA\u3002",
    "- \u53EA\u4F7F\u7528\u5DF2\u786E\u8BA4\u8D44\u6E90\u3002\u5EFA\u8BAE\u7684\u4EBA\u5458\u3001\u8BBE\u5907\u3001\u573A\u5730\u6216\u670D\u52A1\u987B\u5199\u4E3A\u53EF\u9009\u4E14\u8BF4\u660E\u66FF\u4EE3\uFF1B\u4E0D\u51ED\u7A7A\u627F\u8BFA\u514D\u8D39\u670D\u52A1\u3001\u4EF7\u683C\u3001\u4F18\u60E0\u3001\u6548\u679C\uFF0C\u4E0D\u8BBE\u672A\u7ECF\u9A8C\u8BC1\u7684\u5B8C\u64AD\u7387\u6216\u6210\u4EA4\u7387\u5408\u683C\u7EBF\u3002\u6548\u679C\u770B\u7528\u6237\u81EA\u5DF1\u7684\u57FA\u7EBF\u548C\u771F\u5B9E\u6570\u636E\u3002"
  ];
  if (interview) rules.push(
    "\u3010\u91C7\u8BBF\u843D\u5730\u3011\u6BCF\u4E2A\u5207\u53E3\u5148\u5199\u540C\u4E00\u4E2A\u5FC5\u95EE\u4E3B\u95EE\u9898\uFF0C\u518D\u5199\u8BE5\u5207\u53E3\u6DF1\u5165\u7684\u95EE\u9898\u53CA\u81F3\u5C11\u4E24\u6761\u6761\u4EF6\u8FFD\u95EE\u3002\u4E0D\u8981\u53EA\u95EE\u201C\u751F\u610F\u600E\u4E48\u6837\u201D\uFF1A\u8FFD\u95EE\u5177\u4F53\u53D8\u5316\u3001\u53EF\u5206\u4EAB\u7684\u4E8B\u4F8B\u3001\u5224\u65AD\u4F9D\u636E\u3002\u4E0D\u8981\u628A\u5173\u95E8\u65F6\u95F4\u3001\u6CDB\u60C5\u7EEA\u3001\u672A\u6765\u9884\u671F\u6362\u6210\u4E3B\u95EE\u9898\u3002",
    "- \u4E0D\u9884\u8BBE\u7B54\u6848\u4E0D\u540C\u3001\u6709\u53CD\u8F6C\u6216\u8001\u677F\u6C89\u9ED8\uFF1A\u5982\u679C\u4E0D\u540C\uFF0C\u6BD4\u8F83\u5404\u81EA\u4F9D\u636E\uFF1B\u5982\u679C\u4E00\u81F4\uFF0C\u6DF1\u5165\u5171\u540C\u539F\u56E0\u4E0E\u4F8B\u5B50\uFF1B\u4E0D\u77E5\u9053\u4E5F\u5982\u5B9E\u4FDD\u7559\u3002\u5E97\u4E3B\u7684\u611F\u53D7\u4E0D\u80FD\u5305\u88C5\u6210\u8425\u6536\u7EDF\u8BA1\u6216\u6574\u5EA7\u53BF\u57CE\u8D8B\u52BF\u3002",
    "- \u65E0\u91C7\u8BBF\u5B9E\u5F55\u6216\u7528\u6237\u660E\u786E\u5C1A\u672A\u91C7\u8BBF\u65F6\uFF0C\u5168\u90E8\u5019\u9009\u6807\u9898\u3001\u5F00\u5934\u3001\u6B63\u6587\u3001\u5C01\u9762\u53CA\u5EFA\u8BAE\u90FD\u6309\u4E8B\u524D\u65B9\u6848\u5199\uFF0C\u53EA\u8BF4\u51C6\u5907\u95EE\u4EC0\u4E48\u6216\u5F85\u9A8C\u8BC1\u7684\u95EE\u9898\u3002\u7981\u6B62\u201C\u6211\u95EE\u4E86\u4E00\u5708/\u95EE\u8FC7\u51E0\u5BB6/\u6BCF\u5BB6\u7B54\u6848\u4E0D\u4E00\u6837/\u4ED6\u7684\u8BDD\u8BA9\u6211\u610F\u5916\u201D\u7B49\u5DF2\u5B8C\u6210\u62A5\u9053\u8BED\u6C14\uFF0C\u7981\u6B62\u9884\u586B\u8001\u677F\u53F0\u8BCD\u3001\u7B54\u590D\u6BD4\u4F8B\u3001\u7ECF\u8425\u7ED3\u679C\u3002\u53C2\u8003\u7A3F\u51FA\u73B0\u8FD9\u4E9B\u53E5\u5B50\u4E5F\u5FC5\u987B\u6539\u6B63\u3002\u5DF2\u6709\u771F\u5B9E\u5B9E\u5F55\u65F6\u624D\u53EF\u636E\u5B9E\u4FDD\u7559\u3002",
    "- \u7EAF\u6587\u5B57\u6587\u6848\u53EA\u653E\u5DF2\u77E5\u4E3B\u6301\u4EBA/\u65C1\u767D\u53F0\u8BCD\u548C\u5B9E\u9645\u63D0\u95EE\uFF0C\u4E0D\u653E\u672A\u77E5\u56DE\u7B54\u5360\u4F4D\uFF0C\u4E5F\u4E0D\u5199\u672A\u7ECF\u91C7\u8BBF\u9A8C\u8BC1\u7684\u603B\u7ED3\uFF1B\u53D7\u8BBF\u8005\u7684\u201C\u6309\u73B0\u573A\u771F\u5B9E\u56DE\u7B54\u201D\u53EA\u653E\u91C7\u8BBF\u6267\u884C\u7A3F\u6216\u5206\u955C\u4E2D\u3002"
  );
  if (comparison) rules.push(
    "\u3010\u6BD4\u8F83\u53E3\u5F84\u9501\u5B9A\u3011\u5148\u4ECE\u539F\u59CB\u7528\u6237\u60F3\u6CD5\u786E\u5B9A\u4E24\u7AEF\u662F\u4EC0\u4E48\uFF0C\u5728\u6240\u6709\u4E3B\u95EE\u3001\u8FFD\u95EE\u3001\u6807\u9898\u3001\u6B63\u6587\u4E0E\u5206\u955C\u91CC\u4FDD\u6301\u540C\u4E00\u53E3\u5F84\u3002\u524D\u540E\u5BF9\u6BD4\u4E0D\u80FD\u5077\u5077\u53D8\u6210\u540C\u6BD4\u3001\u548C\u5F80\u5E74\u6BD4\u3001\u4E0E\u5E73\u65F6\u6BD4\uFF1B\u7528\u6237\u660E\u786E\u8981\u8FD9\u4E9B\u6BD4\u8F83\u65F6\u624D\u4F7F\u7528\u3002",
    "- \u539F\u610F\u53EA\u8BF4\u201C\u524D\u540E\u201D\u672A\u7ED9\u65E5\u671F\u65F6\uFF0C\u5177\u4F53\u65E5\u671F\u548C\u53E3\u5F84\u5F85\u6838\u5BF9\uFF0C\u4E0D\u64C5\u81EA\u6539\u6362\u6BD4\u8F83\u5BF9\u8C61\u3002\u5404\u5BF9\u8C61\u4FDD\u6301\u76F8\u540C\u65F6\u95F4\u8303\u56F4\u548C\u7EF4\u5EA6\uFF0C\u4E0D\u80FD\u62FF\u4E0D\u540C\u957F\u5EA6\u7684\u603B\u91CF\u76F4\u63A5\u6BD4\u8F83\u3002"
  );
  if (comparison && interview) rules.push(
    "- \u82E5\u7528\u6237\u53EA\u8BF4\u56FD\u5E86\u524D\u540E\uFF0C\u4E3B\u95EE\u9898\u793A\u8303\uFF1A\u201C\u8DDF\u56FD\u5E86\u524D\u7684\u90A3\u6BB5\u65F6\u95F4\u6BD4\uFF0C\u56FD\u5E86\u540E\u8FD9\u51E0\u5929\u60A8\u5E97\u91CC\u751F\u610F\u6709\u4EC0\u4E48\u53D8\u5316\uFF1F\u201D\u5177\u4F53\u65E5\u671F\u62CD\u524D\u7EDF\u4E00\u3002\u8FFD\u95EE\u793A\u8303\uFF1A\u201C\u5177\u4F53\u662F\u6765\u5BA2\u3001\u6BCF\u5355\u6D88\u8D39\u3001\u5FD9\u7684\u65F6\u6BB5\u54EA\u4E00\u9879\u53D8\u4E86\uFF1F\u4E5F\u53EF\u80FD\u6CA1\u53D8\uFF0C\u60A8\u5B9E\u9645\u662F\u54EA\u79CD\uFF1F\u201D\u201C\u80FD\u8BF4\u4E00\u4EF6\u8BA9\u60A8\u8FD9\u6837\u5224\u65AD\u7684\u5177\u4F53\u4E8B\u5417\uFF1F\u201D\u201C\u60A8\u89C9\u5F97\u539F\u56E0\u662F\u4EC0\u4E48\uFF0C\u6709\u4EC0\u4E48\u4F9D\u636E\uFF1F\u201D\u793A\u8303\u4EC5\u9002\u7528\u4E8E\u8FD9\u4E2A\u539F\u610F\uFF1B\u7528\u6237\u660E\u786E\u5047\u671F\u671F\u95F4\u4E0E\u8282\u540E\uFF0C\u5219\u6309\u90A3\u4E24\u4E2A\u65F6\u6BB5\u95EE\uFF0C\u4E0D\u80FD\u5957\u8282\u524D\u3002",
    "- \u6CA1\u6709\u524D\u671F\u5F55\u50CF\u4E5F\u53EF\u91C7\u8BBF\u540C\u4E00\u5E97\u4E3B\u5BF9\u4E24\u4E2A\u65F6\u6BB5\u7684\u56DE\u5FC6\uFF0C\u518D\u8BB0\u5F55\u5F53\u4E0B\u53EF\u89C1\u73B0\u8C61\u5E76\u6CE8\u660E\u8BC1\u636E\u8FB9\u754C\uFF1B\u4E0D\u5B89\u6392\u56DE\u5230\u5DF2\u8FC7\u53BB\u7684\u65E5\u671F\u8865\u62CD\uFF0C\u4E0D\u7F16\u4E24\u6B21\u8D70\u8BBF\uFF0C\u4E0D\u8981\u6C42\u5168\u5929\u8DDF\u62CD\u6765\u66FF\u4EE3\u77ED\u8BBF\u8C08\u3002"
  );
  return rules.join("\n");
}

// .tmp/content-audit-production_20261008/lib/growth-standards.ts
var MATRIX_TABLE = `### \u9009\u62E9\u77E9\u9635\uFF1A\u5148\u9009\u9002\u5408\u81EA\u5DF1\u7684\uFF0C\u800C\u975E\u6700\u70AB\u7684

| \u8D44\u6E90\u6761\u4EF6 | \u4F18\u5148\u5C1D\u8BD5 | \u6682\u7F13 |
|---|---|---|
${SELECTION_MATRIX.map((m) => `| ${m.condition} | ${m.prefer.join("\u3001")} | ${m.defer} |`).join("\n")}

\u26A0\uFE0F \u8FD9\u5F20\u8868\u662F\u8FD9\u4E00\u6B65\u7684\u6838\u5FC3\u3002**\u7528\u6237\u770B\u5B8C 37 \u8BA1\u7684\u7B2C\u4E00\u53CD\u5E94\u662F\u6311\u6700\u6709\u610F\u601D\u7684\uFF0C
\u800C\u4E0D\u662F\u6311\u81EA\u5DF1\u62CD\u5F97\u51FA\u6765\u7684**\u2014\u2014\u5355\u4EBA\u4F4E\u9884\u7B97\u7684\u53F7\u53BB\u5B66\u591A\u4EBA\u5267\u60C5\uFF0C\u62CD\u4E24\u6761\u5C31\u6491\u4E0D\u4F4F\u3002
\u4F60\u8981\u6309\u4ED6\u6863\u6848\u91CC\u7684\u771F\u5B9E\u6761\u4EF6\uFF08\u56E2\u961F\u51E0\u4E2A\u4EBA\u3001\u6709\u4EC0\u4E48\u8BBE\u5907\u3001\u6709\u6CA1\u6709\u95E8\u5E97\u3001
\u64C5\u957F\u8BB2\u6545\u4E8B\u8FD8\u662F\u8BB2\u5E72\u8D27\uFF09\u53BB\u5339\u914D\uFF0C\u4E0D\u662F\u6309\u54EA\u4E00\u8BA1\u66F4\u9177\u3002`;
function parseOpenings(text3) {
  if (!text3) return [];
  const lines = text3.split("\n");
  const heads = [];
  lines.forEach((raw, i) => {
    const m = raw.match(/^#{2,4}\s*\**\s*(?:第\s*)?(\d+)\s*(?:条)?\s*[.、·:：\-\s]\s*\**\s*(.+?)\s*\**\s*$/);
    if (!m) return;
    const label = m[2].replace(/[（(].*?[）)]/g, "").trim();
    const hit = OPENING_CARDS.find((c) => label.includes(c.name));
    if (!hit) return;
    heads.push({ at: i, no: Number(m[1]), card: hit.name });
  });
  const field = (block, key) => {
    for (const l of block) {
      const m = l.match(new RegExp(`^[-*]\\s*\\**${key}\\**\\s*[\uFF1A:]\\s*(.+)$`));
      if (m) return m[1].replace(/\*\*/g, "").trim();
    }
    return "";
  };
  return heads.map((h, idx) => {
    const end = idx + 1 < heads.length ? heads[idx + 1].at : lines.length;
    const block = lines.slice(h.at + 1, end);
    const quoted = block.filter((l) => /^\s*>/.test(l)).map((l) => l.replace(/^\s*>\s?/, "").trim()).filter(Boolean).join(" ");
    const fallback = block.find((l) => l.trim() && !/^[-*#>]/.test(l.trim()))?.trim() ?? "";
    return {
      no: h.no,
      card: h.card,
      line: (quoted || fallback).replace(/^\**|\**$/g, "").trim(),
      why: field(block, "\u4E3A\u4EC0\u4E48\u6293\u5F97\u4F4F\u8FD9\u7FA4\u4EBA"),
      deliver: field(block, "\u6B63\u6587\u600E\u4E48\u5151\u73B0"),
      risk: field(block, "\u98CE\u9669")
    };
  });
}
var cardFull = (c) => `### ${c.no}. ${c.name}\uFF08${c.category}\uFF09

- **\u5FC3\u7406\u673A\u5236**\uFF1A${c.psychology}
- **\u5F00\u7BC7\u516C\u5F0F**\uFF1A${c.formula}
- **\u6267\u884C\u8981\u70B9**\uFF1A${c.howto}
- **\u6848\u4F8B**\uFF1A${c.cases}
- **\u63A8\u8350\u7EC4\u5408**\uFF1A${c.combo}
- **\u98CE\u9669\u8FB9\u754C**\uFF1A${c.risk}`;
function buildOpeningPrompt(p) {
  const count = p.count ?? 6;
  const picked = p.picked?.length ? OPENING_CARDS.filter((c) => p.picked.includes(c.name)) : [];
  const parts = [];
  parts.push(`\u4F60\u662F\u4E00\u4F4D\u77ED\u89C6\u9891\u7F16\u5BFC\uFF0C\u6B63\u5728\u7ED9\u4E00\u6761\u5185\u5BB9\u5199\u5F00\u5934\u3002

**\u5F00\u5934\u8981\u8BA9\u89C2\u4F17\u5C3D\u5FEB\u7406\u89E3\u4E3A\u4EC0\u4E48\u503C\u5F97\u770B\u3002** \u94A9\u5B50\u4E0D\u662F\u8BF1\u9975\u2014\u2014
\u5F00\u5934\u8BB8\u4E0B\u7684\u627F\u8BFA\uFF0C\u6B63\u6587\u5FC5\u987B\u5151\u73B0\uFF0C\u5426\u5219\u5B8C\u64AD\u7387\u4F1A\u66F4\u96BE\u770B\u3002`);
  parts.push("");
  if (p.contextBlock?.trim()) {
    parts.push(p.contextBlock.trim(), "");
  }
  parts.push("## \u{1F3AC} \u8FD9\u6761\u5185\u5BB9", "", `**\u4E3B\u9898**\uFF1A${p.topic.trim()}`, "");
  parts.push(roleInferRule("hook"), "");
  if (p.currentOpening?.trim()) {
    parts.push("**\u73B0\u5728\u7684\u5F00\u5934**\uFF08\u89C9\u5F97\u4E0D\u591F\u6293\u4EBA\uFF0C\u8981\u6362\uFF09\uFF1A", "", p.currentOpening.trim(), "");
  }
  parts.push("## \u{1F4DA} \u5F00\u7BC7\u65B9\u6CD5\u5361", "");
  if (picked.length) {
    parts.push(
      `\u7528\u6237\u5708\u5B9A\u4E86 ${picked.length} \u79CD\u3002**\u6BCF\u4E00\u79CD\u5404\u5199\u4E00\u6761\uFF0C\u4E00\u6761\u90FD\u4E0D\u80FD\u5C11\u3001\u4E5F\u4E0D\u8981\u591A\u5199**\uFF0C`,
      "\u987A\u5E8F\u548C\u4E0B\u9762\u4E00\u81F4\u3002\u540C\u4E00\u6761\u5185\u5BB9\u7528\u4E0D\u540C\u7684\u94A9\u5B50\u5F00\uFF0C\u5DEE\u522B\u5E94\u8BE5\u662F\u770B\u5F97\u51FA\u6765\u7684\u2014\u2014",
      "\u5982\u679C\u4E24\u6761\u5F00\u5934\u6362\u6389\u51E0\u4E2A\u8BCD\u5C31\u4E00\u6837\uFF0C\u8BF4\u660E\u5176\u4E2D\u4E00\u6761\u6CA1\u771F\u7684\u7528\u4E0A\u90A3\u5F20\u5361\u3002",
      ""
    );
    parts.push(picked.map(cardFull).join("\n\n"), "");
  } else {
    parts.push(
      `\u4E0B\u9762\u662F 36 \u79CD\u5F00\u7BC7\u65B9\u6CD5\u3002**\u5148\u770B\u76EE\u6807\u7528\u6237\u548C\u5185\u5BB9\u76EE\u7684\uFF0C\u518D\u9009 1 \u4E2A\u4E3B\u94A9\u5B50\u3001\u6700\u591A 1-2 \u4E2A\u8F85\u52A9\u94A9\u5B50**\u2014\u2014\u5806\u94A9\u5B50\u7B49\u4E8E\u6CA1\u94A9\u5B50\u3002`,
      ""
    );
    parts.push(
      OPENING_CARDS.map((c) => `- **${c.name}**\uFF08${c.category}\uFF09\uFF1A${c.formula}`).join("\n"),
      ""
    );
  }
  parts.push(`## \u{1F4E4} \u8F93\u51FA\u683C\u5F0F

${picked.length ? `\u6309\u4E0B\u9762\u7684\u987A\u5E8F\uFF0C\u7ED9\u8FD9 ${picked.length} \u5F20\u5361\u5404\u5199\u4E00\u6761\uFF0C\u5171 ${picked.length} \u6761\uFF1A

${picked.map((c, i) => `${i + 1}. ${c.name}`).join("\n")}` : `\u6700\u591A\u7ED9 ${count} \u6761\u5019\u9009\uFF0C\u6BCF\u6761\u5207\u5165\u540C\u4E00\u6838\u5FC3\u8BAE\u9898\uFF1B\u4F18\u5148\u9002\u5408\u5F53\u524D\u6750\u6599\u7684\u5361\uFF0C\u4E0D\u4E3A\u51D1\u6570\u91CF\u6362\u4E3B\u9898\u6216\u7F16\u4E8B\u5B9E\u3002`}

**\u6BCF\u6761\u4E25\u683C\u6309\u8FD9\u4E2A\u7ED3\u6784\u5199\uFF0C\u6807\u9898\u884C\u7684\u5361\u540D\u8981\u548C\u4E0A\u9762\u4E00\u5B57\u4E0D\u5DEE\uFF1A**

### 1. \u5361\u540D
> \u5F00\u5934\u539F\u8BDD\uFF08\u8FD9\u662F\u8981\u76F4\u63A5\u5FF5\u51FA\u6765\u7684\uFF0C\u5199\u6210\u53E3\u8BED\uFF0C\u4E0D\u8981\u5199"\uFF08\u505C\u987F\uFF09"\u8FD9\u7C7B\u63D0\u793A\uFF09

- **\u4E3A\u4EC0\u4E48\u6293\u5F97\u4F4F\u8FD9\u7FA4\u4EBA**\uFF1A\u4E00\u53E5\u8BDD\uFF0C\u5BF9\u5E94\u4ED6\u4EEC\u7684\u5904\u5883
- **\u6B63\u6587\u600E\u4E48\u5151\u73B0**\uFF1A\u5F00\u5934\u8BB8\u4E86\u4EC0\u4E48\uFF0C\u6B63\u6587\u5FC5\u987B\u7ED9\u4EC0\u4E48
- **\u98CE\u9669**\uFF1A\u8FD9\u4E48\u5199\u53EF\u80FD\u8E29\u4EC0\u4E48\u5751\uFF08\u6CA1\u6709\u5C31\u5199"\u65E0"\uFF09

\u26A0\uFE0F \u5F00\u5934\u539F\u8BDD\u5FC5\u987B\u5355\u72EC\u653E\u5728 > \u5F15\u7528\u884C\u91CC\uFF0C\u53EA\u653E\u8981\u5FF5\u7684\u90A3\u53E5\u8BDD\uFF0C
\u4E0D\u8981\u628A\u89E3\u91CA\u3001\u62EC\u53F7\u5907\u6CE8\u5199\u8FDB\u5F15\u7528\u884C\u2014\u2014\u8FD9\u4E00\u884C\u4F1A\u88AB\u76F4\u63A5\u62FF\u53BB\u5F53\u811A\u672C\u7684\u5F00\u5934\u3002

\u6700\u540E\u52A0\u4E00\u6BB5\uFF1A

## \u{1F3AF} \u6211\u63A8\u8350\u54EA\u4E00\u6761
\u6311 1 \u6761\uFF0C\u8BF4\u660E\u4E3A\u4EC0\u4E48\u5B83\u6700\u9002\u5408\u8FD9\u4E2A\u53F7\u2014\u2014\u8981\u7ED3\u5408\u8D26\u53F7\u7684\u4EBA\u8BBE\u548C\u53E3\u543B\uFF0C
\u4E0D\u662F\u6311\u6700\u523A\u6FC0\u7684\u90A3\u6761\u3002

## \u270D\uFE0F \u5199\u4F5C\u8981\u6C42

- **\u5F00\u5934\u5199\u6210\u80FD\u76F4\u63A5\u5FF5\u7684\u53E3\u8BED**\uFF0C\u4E0D\u662F\u6587\u6848\u8154
- \u5FC5\u987B\u548C\u8FD9\u4E2A\u53F7\u7684\u53E3\u543B\u4E00\u81F4\uFF08\u770B\u4E0A\u9762\u7684\u4EBA\u8BBE\u4E0E\u53E3\u543B\u90A3\u4E00\u6BB5\uFF09
- \u4E0D\u8981\u7528\u8D26\u53F7\u7981\u5FCC\u91CC\u5199\u660E\u4E0D\u80FD\u8BF4\u7684\u8BDD
- **\u591A\u6837\u6027\u670D\u52A1\u4E8E\u9002\u914D\u6027**\uFF1A\u5141\u8BB8\u540C\u4E00\u673A\u5236\u7684\u4E0D\u540C\u6210\u719F\u8868\u8FBE\uFF0C\u4E0D\u5F3A\u51D1\u516D\u79CD\u5361\uFF1B\u7528\u6237\u624B\u9009\u7684\u6BCF\u5F20\u5361\u8981\u56DE\u5E94\uFF0C\u4E0D\u9002\u7528\u65F6\u8BF4\u660E\u7406\u7531\u5E76\u7ED9\u540C\u4E3B\u7EBF\u66FF\u4EE3\uFF0C\u4E0D\u80FD\u7F16\u7D20\u6750\u53BB\u9002\u914D
- \u627F\u8BFA\u8981\u5151\u73B0\uFF1A\u5199\u4E0D\u51FA\u6B63\u6587\u600E\u4E48\u63A5\u7684\uFF0C\u8FD9\u6761\u5C31\u4E0D\u8981\u7ED9`);
  parts.push(creativeCraftRules({ source: p.topic, context: p.contextBlock }));
  return parts.join("\n");
}

// app/dashboard/script/constants.ts
var SCRIPT_TYPES = {
  teach: { label: "\u6559\u77E5\u8BC6", desc: "\u6559\u5B66\u7C7B\u5185\u5BB9\uFF0C\u4F20\u6388\u6280\u80FD\u548C\u77E5\u8BC6" },
  show: { label: "\u6652\u8FC7\u7A0B", desc: "\u5C55\u793A\u7C7B\u5185\u5BB9\uFF0C\u5206\u4EAB\u7ECF\u5386\u548C\u6210\u679C" },
  discuss: { label: "\u804A\u8BDD\u9898", desc: "\u89C2\u70B9\u7C7B\u5185\u5BB9\uFF0C\u8868\u8FBE\u770B\u6CD5\u548C\u601D\u8003" },
  story: { label: "\u8BB2\u6545\u4E8B", desc: "\u6545\u4E8B\u7C7B\u5185\u5BB9\uFF0C\u8BB2\u8FF0\u7ECF\u5386\u548C\u6848\u4F8B" },
  ad_lead: { label: "\u7559\u8D44\u83B7\u5BA2", desc: "\u6536\u96C6\u7EBF\u7D22\u3001\u52A0\u5FAE\u4FE1\u3001\u7559\u7535\u8BDD" },
  ad_group: { label: "\u56E2\u8D2D\u4FC3\u9500", desc: "\u7F8E\u56E2/\u6296\u97F3\u56E2\u8D2D\u3001\u9650\u65F6\u4F18\u60E0" },
  ad_offline: { label: "\u7EBF\u4E0B\u5F15\u6D41", desc: "\u5230\u5E97\u6838\u9500\u3001\u5B9E\u4F53\u5E97\u5BFC\u6D41" },
  ad_product: { label: "\u4EA7\u54C1\u79CD\u8349", desc: "\u4EA7\u54C1\u63A8\u5E7F\u3001\u529F\u80FD\u5C55\u793A" }
};
var SCRIPT_STRUCTURES = [
  { id: "auto", label: "\u{1F3AF} AI\u63A8\u8350", desc: "\u6839\u636E\u5185\u5BB9\u667A\u80FD\u9009\u62E9" },
  { id: "problem", label: "\u{1F4CC} \u89E3\u9898\u578B", desc: "\u96BE\u9898\u2192\u5371\u673A\u2192\u89E3\u51B3\u2192\u6B65\u9AA4" },
  { id: "recommend", label: "\u{1F44D} \u63A8\u8350\u578B", desc: "\u613F\u666F\u2192\u4EBA\u7FA4\u2192\u597D\u5947\u2192\u7406\u7531" },
  { id: "expose", label: "\u{1F513} \u63ED\u79D8\u578B", desc: "\u53CD\u5E38\u8BC6\u2192\u5185\u5E55\u2192\u793A\u8303" },
  { id: "case", label: "\u{1F4D6} \u6848\u4F8B\u578B", desc: "\u6848\u4F8B\u2192\u62C6\u89E3\u2192\u590D\u5236" },
  { id: "train", label: "\u{1F682} \u706B\u8F66\u8282", desc: "\u76EE\u6807\u2192\u8FC7\u7A0B\u2192\u7ED3\u679C" },
  { id: "argue", label: "\u{1F4AC} \u8BBA\u8BC1\u578B", desc: "\u89C2\u70B9\u2192\u8BBA\u636E\u2192\u5347\u534E" },
  { id: "story", label: "\u{1F4DA} \u6545\u4E8B\u578B", desc: "\u73B0\u72B6\u2192\u56F0\u5883\u2192\u8F6C\u6298\u2192\u6210\u5C31" },
  { id: "compare", label: "\u2696\uFE0F \u5BF9\u6BD4\u578B", desc: "A vs B\u5BF9\u6BD4" },
  { id: "list", label: "\u{1F4DD} \u6E05\u5355\u578B", desc: "N\u4E2A\u65B9\u6CD5/\u6280\u5DE7" },
  { id: "timeline", label: "\u23F0 \u65F6\u95F4\u7EBF\u578B", desc: "\u524D\u540E\u53D8\u5316" },
  { id: "qa", label: "\u2753 \u95EE\u7B54\u578B", desc: "Q&A\u89E3\u7B54" },
  { id: "scene", label: "\u{1F3AC} \u60C5\u666F\u5267\u578B", desc: "\u60C5\u666F\u518D\u73B0" },
  { id: "review", label: "\u{1F50D} \u6D4B\u8BC4\u578B", desc: "\u6D4B\u8BD5\u2192\u7ED3\u679C" },
  { id: "challenge", label: "\u{1F4AA} \u6311\u6218\u578B", desc: "\u6311\u6218\u6253\u5361" },
  { id: "tutorial", label: "\u{1F4D0} \u6559\u7A0B\u578B", desc: "\u6B65\u9AA41\u21922\u21923" },
  { id: "reverse", label: "\u{1F504} \u53CD\u8F6C\u578B", desc: "\u9884\u671FA\u2192\u5B9E\u9645B" },
  { id: "summary", label: "\u{1F4CA} \u76D8\u70B9\u578B", desc: "\u5E74\u5EA6\u76D8\u70B9" },
  { id: "interview", label: "\u{1F3A4} \u91C7\u8BBF\u578B", desc: "\u4EBA\u7269\u8BBF\u8C08" },
  { id: "observe", label: "\u{1F52C} \u89C2\u5BDF\u578B", desc: "\u89C2\u5BDF\u2192\u5206\u6790" }
];

// .tmp/content-audit-production_20261008/lib/deal-reasons.ts
var DEAL_REASONS = [
  { id: "looks", label: "\u989C\u503C\u9AD8", icon: "\u{1F31F}", desc: "\u597D\u770B\u51FA\u7247\u4E0A\u955C" },
  { id: "effect", label: "\u6548\u679C\u597D", icon: "\u2728", desc: "\u6539\u53D8\u660E\u663E" },
  { id: "choice", label: "\u9009\u62E9\u591A", icon: "\u{1F4CB}", desc: "\u54C1\u7C7B\u5168\u6B3E\u5F0F\u591A" },
  { id: "unique", label: "\u6709\u7279\u8272", icon: "\u{1F3A8}", desc: "\u72EC\u5BB6\u552F\u4E00" },
  { id: "convenient", label: "\u4FBF\u5229\u6027", icon: "\u{1F4CD}", desc: "\u8FD1\u5FEB\u65B9\u4FBF" },
  { id: "boss", label: "\u8001\u677F\u597D", icon: "\u{1F468}\u200D\u{1F373}", desc: "\u70ED\u60C5\u4E13\u4E1A" },
  { id: "service", label: "\u670D\u52A1\u597D", icon: "\u{1F48E}", desc: "\u8D34\u5FC3\u7EC6\u81F4" },
  { id: "cases", label: "\u6848\u4F8B\u591A", icon: "\u{1F4CA}", desc: "\u7ECF\u9A8C\u4E30\u5BCC" },
  { id: "prestige", label: "\u6709\u9762\u5B50", icon: "\u{1F3A9}", desc: "\u6863\u6B21\u54C1\u5473" },
  { id: "value", label: "\u6027\u4EF7\u6BD4", icon: "\u{1F4B0}", desc: "\u5B9E\u60E0\u5212\u7B97" },
  { id: "quality", label: "\u8D28\u91CF\u597D", icon: "\u2705", desc: "\u7528\u6599\u8DB3" },
  { id: "popular", label: "\u751F\u610F\u597D", icon: "\u{1F525}", desc: "\u706B\u7206\u6392\u961F" },
  { id: "reputation", label: "\u597D\u8BC4\u591A", icon: "\u2B50", desc: "\u590D\u8D2D\u7387\u9AD8" },
  { id: "professional", label: "\u4E13\u4E1A\u5F3A", icon: "\u{1F393}", desc: "\u6709\u8D44\u8D28" },
  { id: "scale", label: "\u89C4\u6A21\u5927", icon: "\u{1F3E2}", desc: "\u8FDE\u9501\u5206\u5E97\u591A" },
  { id: "rare", label: "\u7A00\u7F3A\u552F\u4E00", icon: "\u{1F984}", desc: "\u9650\u91CF\u72EC\u5BB6" },
  { id: "honest", label: "\u5B9E\u5728\u4E0D\u5751", icon: "\u{1F91D}", desc: "\u900F\u660E\u4E0D\u5BB0\u5BA2" }
];
var LABELS2 = DEAL_REASONS.map((r) => r.label);

// .tmp/content-audit-production_20261008/lib/creation-settings.ts
var STRING_FIELDS = ["topic", "direction", "audience", "industry", "platform", "duration", "scriptType", "structure", "style", "tactic", "openingLine", "hookType", "notes", "scene", "device", "budget", "personnel", "contentType", "visualStyle", "titleType", "titleFormula", "keywordStrategy", "workingScript", "userIntent", "purposeText", "focusContent"];
var ARRAY_FIELDS = ["openingCards", "elements", "dealReasons", "lockedTexts"];
var SCRIPT_TYPE_LABELS = Object.fromEntries(Object.entries(SCRIPT_TYPES).map(([id, value]) => [id, value.label]));
var PLACEHOLDERS = /* @__PURE__ */ new Set([
  "\u57FA\u4E8E\u5DF2\u6709\u5185\u5BB9\u7EE7\u7EED\u521B\u4F5C",
  "\u4FDD\u7559\u539F\u7A3F\u6838\u5FC3\u89C2\u70B9\u4E0E\u521B\u610F\uFF0C\u5B8C\u6210\u4E0B\u4E00\u73AF\u8282",
  "\u5BF9\u8FD9\u6761\u5185\u5BB9\u4E3B\u9898\u6709\u5B9E\u9645\u9700\u6C42\u7684\u4EBA\u7FA4",
  "\u5B9E\u9645\u7ECF\u8425\u6216\u5DE5\u4F5C\u573A\u666F",
  "\u4FDD\u7559\u539F\u7A3F\u7684\u65B9\u5411\u3001\u4EBA\u7FA4\u4E0E\u521B\u610F\uFF0C\u57FA\u4E8E\u5F53\u524D\u6863\u6848\u5B8C\u6210\u4E8C\u521B",
  "\u77E5\u8BC6\u5206\u4EAB"
]);
function mergeCreationSettings(...values) {
  const out = {};
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    const v = value;
    for (const key of STRING_FIELDS) if (typeof v[key] === "string" && v[key].trim() && !PLACEHOLDERS.has(v[key].trim())) out[key] = v[key].trim();
    for (const key of ARRAY_FIELDS) if (Array.isArray(v[key])) out[key] = v[key].filter((x) => typeof x === "string" && Boolean(x.trim())).map((x) => x.trim());
    if (v.purpose === "\u6D41\u91CF\u578B" || v.purpose === "\u4EBA\u8BBE\u578B" || v.purpose === "\u53D8\u73B0\u578B") out.purpose = v.purpose;
    else if (typeof v.purposeText === "string" && v.purposeText.trim()) delete out.purpose;
    for (const key of ["topicCount", "titleCount"]) if (typeof v[key] === "number" && Number.isFinite(v[key]) && v[key] > 0) out[key] = Math.round(v[key]);
  }
  return out;
}
function creationSettingsBlock(settings) {
  const b = mergeCreationSettings(settings);
  if (b.lockedTexts?.length) b.notes = [b.notes, "\u4EE5\u4E0B\u7528\u6237\u9501\u5B9A\u7247\u6BB5\u5FC5\u987B\u9010\u5B57\u4FDD\u7559\uFF0C\u4E0D\u5F97\u6539\u5199\u6216\u5220\u9664\uFF1A", ...b.lockedTexts.map((t) => `\u3010\u9501\u5B9A\u7247\u6BB5\u3011${t}`)].filter(Boolean).join("\n");
  const lines = [["\u4E3B\u9898", b.topic], ["\u5185\u5BB9\u65B9\u5411", b.direction], ["\u76EE\u6807\u4EBA\u7FA4", b.audience], ["\u884C\u4E1A", b.industry], ["\u53D1\u5E03\u5E73\u53F0", b.platform], ["\u89C6\u9891\u65F6\u957F", b.duration], ["\u811A\u672C\u7C7B\u578B", b.scriptType && SCRIPT_TYPE_LABELS[b.scriptType]], ["\u811A\u672C\u7ED3\u6784", SCRIPT_STRUCTURES.find((s) => s.id === b.structure)?.label], ["\u89C6\u9891\u76EE\u7684", b.purpose], ["\u5185\u5BB9\u98CE\u683C", b.style], ["\u62CD\u6CD5", b.tactic], ["\u786E\u5B9A\u7684\u5F00\u5934", b.openingLine], ["\u5F00\u7BC7\u5361", b.openingCards?.join("\u3001")], ["\u6210\u4EA4\u7406\u7531", b.dealReasons?.join("\u3001")], ["\u62CD\u6444\u573A\u5730", b.scene], ["\u8BBE\u5907", b.device], ["\u9884\u7B97", b.budget], ["\u4EBA\u5458", b.personnel], ["\u8865\u5145\u8981\u6C42", b.notes]].filter(([, v]) => v);
  if (b.purposeText && !b.purpose) lines.push(["\u5B8C\u6574\u76EE\u7684", b.purposeText]);
  if (b.userIntent) lines.push(["\u539F\u59CB\u7528\u6237\u60F3\u6CD5", b.userIntent]);
  if (b.focusContent) lines.push(["\u7528\u6237\u5F53\u524D\u9009\u5B9A\u7684\u5177\u4F53\u4E3B\u7EBF", b.focusContent + "\n\u540E\u7EED\u65B9\u5411\u3001\u9009\u9898\u3001\u811A\u672C\u53CA\u4F18\u5316\u5168\u90E8\u4ECE\u8FD9\u6761\u5177\u4F53\u4E3B\u7EBF\u5C55\u5F00\uFF0C\u4E0D\u9000\u56DE\u66F4\u5BBD\u6CDB\u7684\u5927\u65B9\u5411\uFF0C\u4E0D\u6DF7\u5165\u672A\u52FE\u9009\u65B9\u6848\u3002\u539F\u59CB\u60F3\u6CD5\u4FDD\u7559\u76EE\u7684\u3001\u4EBA\u7FA4\u548C\u9650\u5236\uFF1B\u65B0\u9009\u9898\u53EF\u53D8\u5316\uFF0C\u4F46\u6838\u5FC3\u8BAE\u9898\u4E0E\u89D2\u5EA6\u5FC5\u987B\u627F\u63A5\u3002\u7528\u6237\u4E4B\u540E\u660E\u786E\u4FEE\u6539\u65F6\u624D\u6539\u4E3B\u7EBF\u3002"]);
  return lines.length ? `

\u3010\u672C\u6761\u521B\u4F5C\u7684\u8FDE\u7EED\u8BBE\u7F6E\u3011
${lines.map(([k, v]) => `- ${k}\uFF1A${v}`).join("\n")}
\u8FD9\u4E9B\u662F\u672C\u6761\u5185\u5BB9\u7684\u521B\u4F5C\u8BBE\u7F6E\uFF0C\u4F18\u5148\u4E8E\u901A\u7528\u884C\u4E1A\u6A21\u677F\uFF0C\u540E\u7EED\u73AF\u8282\u4FDD\u6301\u4E00\u81F4\u3002\u65B9\u5411\u3001\u4EBA\u7FA4\u3001\u76EE\u7684\u3001\u7ED3\u6784\u548C\u65F6\u957F\u4E0D\u5F97\u64C5\u81EA\u66F4\u6362\uFF1B\u4FDD\u7559\u5DF2\u9009\u5F00\u5934\u3002\u4E0D\u5F97\u628A\u8FC7\u7A0B\u5C55\u793A\u6539\u6210\u65E0\u5173\u521B\u4E1A\u6545\u4E8B\uFF0C\u4E5F\u4E0D\u5F97\u628A\u4EBA\u8BBE\u7A3F\u6539\u6210\u4FC3\u9500\u5E7F\u544A\u3002\u7528\u6237\u672C\u8F6E\u660E\u786E\u4FEE\u6539\u4F18\u5148\uFF1B\u539F\u59CB\u7528\u6237\u60F3\u6CD5\u4E2D\u7684\u76EE\u7684\u3001\u7ACB\u573A\u3001\u4EBA\u7FA4\u548C\u9650\u5236\u7EE7\u7EED\u751F\u6548\uFF0C\u539F\u5148\u201C\u751F\u6210\u6807\u9898/\u5BA1\u7A3F\u201D\u7B49\u64CD\u4F5C\u6307\u4EE4\u4E0D\u91CD\u590D\u6267\u884C\uFF0C\u6539\u4E3A\u5B8C\u6210\u5F53\u524D\u677F\u5757\u7684\u4EFB\u52A1\u3002\u539F\u610F\u7EA6\u675F\u9002\u7528\u4E8E\u6574\u4EFD\u6210\u7A3F\u3001\u7ED3\u5C3E\u548C\u540E\u7EED\u5EFA\u8BAE\uFF1A\u4E0D\u5356\u8BFE/\u4E0D\u63A8\u9500/\u4E0D\u5F15\u5BFC\u79C1\u4FE1\u7B49\u7981\u6B62\u9879\u4E0D\u80FD\u6539\u6210\u201C\u672C\u6761\u6682\u65F6\u4E0D\u505A\u3001\u540E\u7EED\u8F6C\u5316\u201D\uFF1B\u6CA1\u6709\u6765\u6E90\u7684\u7B2C\u4E00\u4EBA\u79F0\u7ECF\u5386\u3001\u5BA2\u6237\u5BF9\u8BDD\u3001\u987E\u5BA2\u53CD\u9988\u4E0D\u5F97\u5192\u5145\u4E8B\u5B9E\uFF0C\u9700\u8981\u4F8B\u5B50\u7528\u660E\u786E\u5047\u8BBE\u8868\u8FBE\u3002\u81EA\u52A8\u63A8\u8350\u3001\u9ED8\u8BA4\u914D\u6BD4\u3001\u77E5\u8BC6\u5E93\u793A\u4F8B\u548C AI \u7A3F\u4E2D\u53CD\u63A8\u7684\u6807\u7B7E\u90FD\u4E0D\u80FD\u66FF\u6362\u7528\u6237\u76EE\u7684\uFF1B\u672A\u6807\u660E\u76EE\u7684\u65F6\u4E0D\u8981\u4EC5\u56E0\u6709\u79C1\u4FE1\u6216\u5230\u5E97\u7ED3\u5C3E\u5C31\u6539\u5224\u53D8\u73B0\u578B\u3002\u7F3A\u5931\u7684\u4FE1\u606F\u4E0D\u80FD\u7F16\u9020\u6210\u7ECF\u8425\u4E8B\u5B9E\uFF1B\u6B21\u6570\u3001\u9500\u91CF\u3001\u4EF7\u683C\u548C\u7ECF\u5386\u6CA1\u6709\u539F\u7A3F\u4F9D\u636E\u65F6\u7528\u5F85\u6838\u5B9E\u5360\u4F4D\uFF0C\u5EFA\u8BAE\u548C\u4F18\u5316\u7A3F\u4E5F\u4E0D\u80FD\u64C5\u81EA\u586B\u6570\u5B57\u3002` : "";
}

// .tmp/content-audit-production_20261008/lib/positioning-sections.ts
var SECTIONS = [
  {
    key: "summary",
    label: "\u6838\u5FC3\u7ED3\u8BBA",
    match: /核心结论/,
    level: 2,
    refs: [],
    hint: "\u6574\u4EFD\u65B9\u6848\u7684\u6458\u8981\u3002\u6539\u4E86\u5B83\u4E0D\u5F71\u54CD\u5176\u4ED6\u8282\uFF0C\u4F46\u5176\u4ED6\u8282\u6539\u4E86\u5B83\u5C31\u8BE5\u8DDF\u7740\u6539"
  },
  {
    key: "industry",
    label: "\u5148\u8BF4\u8FD9\u4E00\u884C",
    match: /先说这一行/,
    level: 2,
    refs: ["industry"],
    hint: "\u8FD9\u95E8\u751F\u610F\u7684\u89C4\u5F8B\u3002\u89C9\u5F97\u8BF4\u5F97\u4E0D\u5BF9\u4F60\u8FD9\u884C\uFF0C\u91CD\u751F\u6210\u65F6\u628A\u5B9E\u60C5\u544A\u8BC9\u5B83"
  },
  {
    key: "interview",
    label: "\u6211\u4F1A\u5148\u95EE\u8001\u677F\u7684\u51E0\u4E2A\u95EE\u9898",
    match: /先问老板/,
    level: 2,
    refs: ["stance"],
    hint: "\u524D\u91C7\u95EE\u9898\u548C\u63A8\u6D4B\u3002\u63A8\u6D4B\u9519\u4E86\u6B63\u597D\u5728\u8FD9\u91CC\u7EA0\u6B63"
  },
  {
    key: "oneline",
    label: "\u4E00\u53E5\u8BDD\u5B9A\u4F4D",
    match: /一句话定位/,
    level: 2,
    refs: [],
    hint: "\u6700\u5E38\u9700\u8981\u5FAE\u8C03\u7684\u4E00\u53E5\u3002\u76F4\u63A5\u6539\u5F80\u5F80\u6BD4\u91CD\u751F\u6210\u5FEB"
  },
  {
    key: "persona",
    label: "\u4EBA\u8BBE\u5B9A\u4F4D",
    match: /人设定位/,
    level: 3,
    refs: ["persona", "stance"],
    hint: "\u4EBA\u8BBE\u6807\u7B7E\u3001\u9A8C\u8BC1\u3001\u5728\u540C\u884C\u91CC\u7684\u4F4D\u7F6E"
  },
  {
    key: "audience",
    label: "\u7528\u6237\u5B9A\u4F4D",
    match: /用户定位/,
    level: 3,
    refs: ["industry"],
    hint: "\u8BF4\u7ED9\u8C01\u542C\u3002\u4EBA\u7FA4\u5199\u504F\u662F\u6700\u5E38\u89C1\u7684\u504F\u5DEE"
  },
  {
    key: "content",
    label: "\u5185\u5BB9\u5B9A\u4F4D",
    match: /内容定位/,
    level: 3,
    refs: ["contentMix", "roles", "routes", "audienceChange"],
    hint: "\u4E3B\u6253\u7C7B\u578B\u548C\u914D\u6BD4"
  },
  {
    key: "presentation",
    label: "\u5448\u73B0\u5B9A\u4F4D",
    match: /呈现定位/,
    level: 3,
    refs: ["presentation"],
    hint: "\u7528\u4EC0\u4E48\u5F62\u5F0F\u62CD\u3001\u4E00\u5468\u80FD\u51FA\u51E0\u6761"
  },
  {
    key: "tone",
    label: "\u98CE\u683C\u8C03\u6027",
    match: /风格调性/,
    level: 3,
    refs: ["tone"],
    hint: "\u6C14\u8D28\u3001\u4F1A\u8BF4\u548C\u4E0D\u4F1A\u8BF4\u7684\u8BDD"
  },
  {
    key: "monetize",
    label: "\u53D8\u73B0\u5B9A\u4F4D",
    match: /变现定位/,
    level: 3,
    refs: ["economy"],
    hint: "\u53EA\u7ED9\u7ED3\u8BBA\u3002\u5B8C\u6574\u62C6\u89E3\u5728\u300C\u5546\u4E1A\u5B9A\u4F4D\u300D\u677F\u5757"
  },
  {
    key: "memory",
    label: "\u8BB0\u5FC6\u70B9\u8BBE\u8BA1",
    match: /记忆点/,
    level: 2,
    refs: ["memory"],
    hint: "\u53E3\u5934\u7985\u3001\u624B\u52BF\u3001\u9053\u5177"
  },
  {
    key: "diff",
    label: "\u5DEE\u5F02\u5316",
    match: /差异化/,
    level: 2,
    refs: ["diff"],
    hint: "\u5E38\u89C4\u505A\u6CD5 + \u4E00\u4E2A\u53D8\u91CF"
  },
  {
    key: "fivepack",
    label: "\u8D26\u53F7\u4E94\u4EF6\u5957",
    match: /五件套/,
    level: 2,
    refs: [],
    hint: "\u5934\u50CF\u3001\u6635\u79F0\u3001\u7B80\u4ECB\u3001\u80CC\u666F\u56FE\u3001\u7F6E\u9876"
  },
  {
    key: "coherence",
    label: "\u81EA\u6D3D\u68C0\u9A8C",
    match: /自洽检验/,
    level: 2,
    refs: ["coherence"],
    hint: "\u906E\u5B57\u5E55\u3001\u53EA\u542C\u58F0\u97F3\u3001\u4E09\u4EF6\u5957\u662F\u5426\u50CF\u540C\u4E00\u4E2A\u53F7"
  },
  {
    key: "risk",
    label: "\u6700\u5927\u7684\u98CE\u9669",
    match: /最大的风险/,
    level: 2,
    refs: [],
    hint: "\u8BF4\u5B9E\u8BDD\u7684\u90A3\u4E00\u8282\uFF0C\u4E0D\u8981\u7C89\u9970"
  }
];
var BY_KEY2 = new Map(SECTIONS.map((s) => [s.key, s]));
function splitChunks(markdown) {
  const lines = markdown.split("\n");
  const out = [];
  let cur = null;
  for (const line2 of lines) {
    const m = line2.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (m) {
      const level = m[1].length;
      const hit = SECTIONS.find((s) => s.level === level && s.match.test(m[2]));
      if (hit) {
        if (cur) out.push(cur);
        cur = { key: hit.key, heading: line2.trim(), body: "" };
        continue;
      }
      if (level === 2) {
        if (cur) out.push(cur);
        cur = null;
        continue;
      }
    }
    if (cur) cur.body += line2 + "\n";
  }
  if (cur) out.push(cur);
  return out;
}
var QUICK_SECTION_KEYS = ["summary", "oneline", "persona", "audience", "content"];
function buildQuickOutputSpec() {
  const chunks = splitChunks(OUTPUT_FULL);
  const picked = QUICK_SECTION_KEYS.map((k) => chunks.find((c) => c.key === k)).filter(
    (c) => Boolean(c)
  );
  return [
    "## \u{1F4E4} \u8F93\u51FA\u683C\u5F0F",
    "",
    "\u6309\u4E0B\u9762\u7684\u987A\u5E8F\u8F93\u51FA\uFF0C\u6807\u9898\u539F\u6837\u4FDD\u7559\u3002\u4E0D\u8981\u6709\u524D\u8A00\uFF0C\u4E0D\u8981\u590D\u8FF0\u6211\u7ED9\u4F60\u7684\u6863\u6848\u3002",
    "",
    "# \u{1F3AF} \u8D26\u53F7\u5B9A\u4F4D\u65B9\u6848",
    "",
    ...picked.map((c) => `${c.heading}
${c.body.trimEnd()}`),
    "",
    "---",
    "",
    "\u26A0\uFE0F **\u53EA\u8F93\u51FA\u4E0A\u9762\u8FD9\u51E0\u8282\uFF0C\u4E0D\u8981\u81EA\u5DF1\u8865\u522B\u7684\u5C0F\u8282\u3002**",
    "\u8FD9\u662F\u5FEB\u901F\u7248\uFF1A\u5148\u628A\u6700\u8981\u7D27\u7684\u51E0\u4EF6\u4E8B\u8BF4\u6E05\u695A\uFF0C\u5176\u4F59\u90E8\u5206\u7528\u6237\u9700\u8981\u65F6\u4F1A\u5355\u72EC\u518D\u8981\u3002"
  ].join("\n\n");
}
function extractSpecs() {
  const out = {};
  for (const c of splitChunks(OUTPUT_FULL)) out[c.key] = c.body.trim();
  return out;
}
var SECTION_SPECS = extractSpecs();

// .tmp/content-audit-supplement_20261008.ts
for (const line2 of import_node_fs.default.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line2.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
}
var dir = "docs/\u5168\u521B\u4F5C\u677F\u5757\u5B9E\u6D4B_20261008";
var base = JSON.parse(import_node_fs.default.readFileSync(dir + "/\u6B63\u5F0F\u6A21\u578B\u5B9E\u6D4B.json", "utf8"));
async function main() {
  if (process.argv[2] === "interview") {
    const row = base.results.find((x) => x.id === "01_interview_extract");
    const ex = parseExtraction(row.answer, base.fixtures.interviewSource);
    const prompt = buildCheckPrompt(ex, base.fixtures.interviewSource);
    import_node_fs.default.writeFileSync(dir + "/\u6A21\u578B\u539F\u59CB\u8BB0\u5F55/01b_interview_check_\u8F93\u5165.txt", prompt);
    const start = Date.now();
    const checked = await askDify(prompt, "kaiwu-platform-audit-synthetic-20261008-interview-check", "\u524D\u91C7\u5EFA\u6863 \u5B57\u6BB5\u8BC1\u636E\u6821\u5BF9", { signal: AbortSignal.timeout(18e4) });
    if (!checked.ok) throw Error(checked.message);
    const final = applyCheck(ex, checked.text);
    import_node_fs.default.writeFileSync(dir + "/\u524D\u91C7\u53CC\u6B65\u63D0\u53D6\u9A8C\u6536.json", JSON.stringify({ elapsedMs: row.elapsedMs + Date.now() - start, firstCallMs: row.elapsedMs, secondCallMs: Date.now() - start, extraction: final, rawCheck: checked.text, usage: checked.completion.usage }, null, 2));
    console.log(JSON.stringify({ checked: true, fields: final.fields.length, flagged: final.fields.filter((x) => x.check?.ok === false) }));
  } else if (process.argv[2] === "positioning") {
    const prompt = buildPositioningPrompt({ profileSummary: buildProfileSummary(base.profile), platform: "\u6296\u97F3", restrictions: base.profile.content_restrictions, focus: "full", outputSpec: buildQuickOutputSpec(), additionalNotes: "\u53EA\u57FA\u4E8E\u5DF2\u63D0\u4F9B\u8D44\u6599\u5236\u5B9A\u53EF\u6267\u884C\u65B9\u6848\u3002\u7ECF\u8425\u5E74\u9650\u3001\u4EF7\u683C\u3001\u9500\u91CF\u6CA1\u6709\u786E\u8BA4\u3002" });
    const start = Date.now();
    const r = await askDify(prompt, "kaiwu-platform-audit-synthetic-20261008-positioning-default-quick", "\u5BB6\u5177\u5B9E\u4F53\u5E97 \u8D26\u53F7\u5B9A\u4F4D \u4EBA\u8BBE \u7528\u6237", { signal: AbortSignal.timeout(3e5) });
    const record = { scope: "\u751F\u4EA7\u9875\u9762\u9ED8\u8BA4\u5FEB\u901F\u7248\uFF0C\u4E0E\u9996\u8F6E\u5B8C\u6574\u7248300\u79D2\u8D85\u65F6\u533A\u5206", ok: r.ok, elapsedMs: Date.now() - start, answer: r.ok ? r.text : r.message, usage: r.ok ? r.completion.usage : {} };
    import_node_fs.default.writeFileSync(dir + "/\u8D26\u53F7\u5B9A\u4F4D\u9ED8\u8BA4\u5FEB\u901F\u7248\u5B9E\u6D4B.json", JSON.stringify(record, null, 2));
    import_node_fs.default.writeFileSync(dir + "/\u6A21\u578B\u539F\u59CB\u8BB0\u5F55/02b_positioning_quick_\u8F93\u5165.txt", prompt);
    if (r.ok) import_node_fs.default.writeFileSync(dir + "/\u6A21\u578B\u539F\u59CB\u8BB0\u5F55/02b_positioning_quick_\u8F93\u51FA.md", r.text);
    console.log(JSON.stringify({ ...record, answer: void 0, usage: void 0 }));
  } else if (process.argv[2] === "opening") {
    const ctx = { profile: base.profile, positioning: null, dealReasons: [], brief: base.results.find((x) => x.id === "11_brief")?.answer };
    const settings = { topic: "\u4E70\u8863\u67DC\u524D\u5148\u770B\u95E8\u4E0E\u62BD\u5C49\u6253\u5F00\u7684\u4F4D\u7F6E", duration: "30\u79D2", userIntent: base.fixtures.furnitureIntent, audience: "\u672C\u5730\u88C5\u4FEE\u5BB6\u5EAD", device: "\u624B\u673A", personnel: "\u4E00\u4EBA" };
    const prompt = buildOpeningPrompt({ topic: settings.topic, contextBlock: buildContextBlock(ctx, "script") + creationSettingsBlock(settings), currentOpening: base.fixtures.rawDraft, count: 3 });
    const start = Date.now();
    const r = await askDify(prompt, "kaiwu-platform-audit-synthetic-20261008-opening-correct-context", "\u8863\u67DC\u5F00\u5408\u7A7A\u95F4 \u5F00\u7BC7\u94A9\u5B50", { signal: AbortSignal.timeout(3e5) });
    if (!r.ok) throw Error(r.message);
    import_node_fs.default.writeFileSync(dir + "/\u6A21\u578B\u539F\u59CB\u8BB0\u5F55/15b_opening_\u8F93\u5165.txt", prompt);
    import_node_fs.default.writeFileSync(dir + "/\u6A21\u578B\u539F\u59CB\u8BB0\u5F55/15b_opening_\u8F93\u51FA.md", r.text);
    import_node_fs.default.writeFileSync(dir + "/\u5F00\u7BC7\u5B9E\u9645\u9875\u9762\u4E0A\u4E0B\u6587\u590D\u6D4B.json", JSON.stringify({ scope: "\u6309\u751F\u4EA7growth\u9875\u9762\u4F7F\u7528script\u4E0A\u4E0B\u6587\uFF0C\u4E0E\u521D\u8F6E\u8BEF\u7528opening\u4E0A\u4E0B\u6587\u533A\u5206\uFF0C\u4EE5\u672C\u6B21\u4E3A\u51C6", elapsedMs: Date.now() - start, answer: r.text, parsedItems: parseOpenings(r.text).length, usage: r.completion.usage }, null, 2));
    console.log(JSON.stringify({ ok: true, parsedItems: parseOpenings(r.text).length, elapsedMs: Date.now() - start }));
  }
}
main().catch((e) => {
  console.error(e.name + ": " + e.message);
  process.exitCode = 1;
});
/*! Bundled license information:

react/cjs/react.production.min.js:
  (**
   * @license React
   * react.production.min.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)

react/cjs/react.development.js:
  (**
   * @license React
   * react.development.js
   *
   * Copyright (c) Facebook, Inc. and its affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *)
*/
