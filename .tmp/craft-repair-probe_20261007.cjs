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
        function escapeUserProvidedKey(text2) {
          return text2.replace(userProvidedKeyEscapeRegex, "$&/");
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
        stack = stack.split("\n").slice(4).filter((line) => {
          if (line.includes("node_modules/next/")) {
            return false;
          }
          if (line.includes(" (<anonymous>)")) {
            return false;
          }
          if (line.includes(" (node:")) {
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

// .tmp/craft-repair-probe_20261007.ts
var import_node_fs = __toESM(require("node:fs"));

// lib/dify-errors.ts
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

// lib/creation-quota.ts
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

// lib/chat-attachments.ts
var MAX_CHAT_FILE_BYTES = 10 * 1024 * 1024;
var CHAT_FILE_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.pdf,.docx,.xlsx,.csv,.pptx,.txt,.md,.html,.xml";
var CHAT_FILE_EXTENSIONS = new Set(CHAT_FILE_ACCEPT.split(",").map((x) => x.slice(1)));

// lib/chat-attachments-server.ts
function toDifyFiles(files) {
  return files.map((file) => ({ type: file.type, transfer_method: "local_file", upload_file_id: file.id }));
}

// lib/dify-task.ts
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
  let text2 = "";
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
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      let data;
      try {
        data = JSON.parse(line.slice(6));
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
      if ((data.event === "message" || data.event === "text_chunk") && chunk) text2 += chunk;
    }
  }
  reader.releaseLock();
  if (!text2.trim()) return { ok: false, message: "\u8FD9\u6B21\u6CA1\u8BFB\u51FA\u7ED3\u679C\uFF0C\u8BF7\u91CD\u8BD5" };
  if (!terminal) return { ok: false, message: "\u56DE\u7B54\u6CA1\u6709\u5B8C\u6574\u7ED3\u675F\uFF0C\u8BF7\u91CD\u8BD5" };
  return { ok: true, text: text2, completion: { terminal, conversationId, messageId, usage } };
}

// lib/taboos.ts
var ANALYSIS = "(?!\u7684?(?:\u4F18\u52BF|\u77ED\u677F|\u95EE\u9898|\u96BE\u70B9|\u98CE\u9669|\u533A\u522B|\u597D\u5904|\u7279\u70B9|\u5356\u70B9|\u4EAE\u70B9|\u539F\u56E0|\u6311\u6218|\u969C\u788D|\u963B\u529B|\u53D8\u5316|\u6536\u83B7|\u611F\u53D7|\u56F0\u96BE|\u75DB\u70B9|\u673A\u4F1A|\u5DEE\u8DDD|\u4E0D\u540C|\u6559\u8BAD))";
var MEASURE = "(?!\u7684?(?:\u89D2\u5EA6|\u5C3A\u5BF8|\u627F\u91CD|\u529F\u7387|\u5BB9\u91CF|\u9650\u5EA6|\u7A0B\u5EA6|\u8303\u56F4|\u503C|\u901F\u5EA6|\u6E29\u5EA6|\u5F00\u53E3|\u5E45\u5EA6|\u957F\u5EA6|\u5BBD\u5EA6|\u9AD8\u5EA6|\u6DF1\u5EA6|\u91CD\u91CF|\u9762\u79EF|\u6863|\u706B|\u53F7|\u7801|\u97F3\u91CF|\u4EAE\u5EA6|\u529B\u5EA6|\u538B\u529B))";
var ABSOLUTE = `(?:\u5168\u7F51|\u5168\u57CE|\u5168\u56FD|\u5168\u5E02|\u53F2\u4E0A)?\u6700(?:\u6B63\u5B97|\u597D\u5403|\u597D(?![\u5148\u662F\u522B\u4E0D\u80FD\u7528\u5728\u8FD8\u6BCF\u627E\u628A\u8BA9\u7ED9\u4ECE\u518D\u591A\u5C11\u8D81\u63D0\u65E9\u8DDF])${ANALYSIS}|\u4FBF\u5B9C|\u4F4E\u4EF7|\u5B9E\u60E0|\u5212\u7B97|\u4E13\u4E1A|\u5730\u9053|\u5F3A|\u4F73|\u5927${ANALYSIS}${MEASURE}|\u5168|\u706B|\u9AD8\u7AEF|\u5B89\u5168|\u9760\u8C31)|\u5168\u7F51\u6700|\u5168\u57CE\u6700|\u7B2C\u4E00(?:\u5BB6|\u540D|\u54C1\u724C)|(?:\u5168\u56FD|\u5168\u5E02|\u5168\u57CE|\u5357\u4E50|\u53BF\u57CE)\u7B2C\u4E00|\u9876\u7EA7|\u6781\u81F4|\u56FD\u5BB6\u7EA7|\u72EC\u5BB6|\u552F\u4E00|\u53F2\u4E0A\u6700`;

// lib/profile-options.ts
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

// lib/profile-fields.ts
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

// lib/interview-exclusions.ts
var LABEL = new Map(PROFILE_FIELDS.map((f) => [f.key, f.label]));
var LABELS = new Set(PROFILE_FIELDS.map((f) => f.label));
var KIND = new Map(PROFILE_FIELDS.map((f) => [f.key, f.kind]));

// lib/persona-facts.ts
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

// lib/content-mix.ts
var STAGE_MIX = [
  { stage: "\u521A\u8D77\u53F7\uFF0C\u5B9A\u4F4D\u672A\u786E\u5B9A", mix: { \u6D41\u91CF\u578B: 60, \u4EBA\u8BBE\u578B: 25, \u53D8\u73B0\u578B: 15 }, why: "\u521A\u8D77\u53F7\u5148\u62FF\u7A33\u5B9A\u6D41\u91CF\u548C\u6B63\u53CD\u9988\uFF0C\u6D41\u91CF\u578B\u6700\u5927\uFF1B\u53D8\u73B0\u578B\u7B2C\u4E00\u5468\u5C31\u6709\uFF0C\u4F46\u53EA\u5360\u5C0F\u5934\uFF0C\u514D\u5F97\u50CF\u5E7F\u544A\u53F7" },
  { stage: "\u6709\u5B9A\u4F4D\uFF0C\u9700\u8981\u5185\u5BB9\u65B9\u5411", mix: { \u6D41\u91CF\u578B: 45, \u4EBA\u8BBE\u578B: 25, \u53D8\u73B0\u578B: 30 }, why: "\u6D41\u91CF\u5F00\u59CB\u7A33\u4E86\uFF0C\u53D8\u73B0\u578B\u6162\u6162\u957F\u4E0A\u6765\uFF0C\u6D41\u91CF\u578B\u4ECD\u7136\u662F\u4E3B\u529B" },
  { stage: "\u7A33\u5B9A\u8FD0\u8425\uFF0C\u9700\u8981\u65B0\u9009\u9898", mix: { \u6D41\u91CF\u578B: 30, \u4EBA\u8BBE\u578B: 20, \u53D8\u73B0\u578B: 50 }, why: "\u6D41\u91CF\u5DF2\u7ECF\u7A33\u5B9A\uFF0C\u6309\u4EE3\u8FD0\u8425 SOP \u7684\u6807\u51C6\u914D\u6BD4\uFF0C\u53D8\u73B0\u578B\u5360\u4E00\u534A" },
  { stage: "\u6210\u719F\u671F\uFF0C\u9700\u8981\u7A81\u7834", mix: { \u6D41\u91CF\u578B: 40, \u4EBA\u8BBE\u578B: 30, \u53D8\u73B0\u578B: 30 }, why: "\u6210\u719F\u671F\u8981\u7A81\u7834\uFF0C\u5F97\u91CD\u65B0\u62C9\u65B0\u4EBA\u3001\u52A0\u6DF1\u4EBA\u8BBE\uFF0C\u6D41\u91CF\u578B\u548C\u4EBA\u8BBE\u578B\u5F80\u56DE\u52A0" }
];
var FALLBACK = STAGE_MIX[1];

// lib/quality-checks.ts
var QUALITY_LABELS = {
  taboo: "\u8E29\u7981\u5FCC",
  excluded: "\u7528\u4E86\u6392\u9664\u7684\u4FE1\u606F",
  mix: "\u914D\u6BD4\u5BF9\u4E0D\u4E0A",
  years: "\u5E74\u9650\u548C\u4EBA\u8BBE\u4E8B\u5B9E\u5361\u4E0D\u7B26",
  generation: "\u751F\u6210\u672A\u5B8C\u6210\u6216\u5185\u5BB9\u7F3A\u5931",
  facts: "\u5173\u952E\u4E8B\u5B9E\u6CA1\u6709\u51FA\u5904\uFF08\u4EF7\u683C\u3001\u767E\u5206\u6BD4\u3001\u987E\u5BA2\u89C1\u8BC1\u3001\u7ECF\u8425\u627F\u8BFA\u3001\u8D44\u5386\u3001\u6570\u636E\u3001\u5730\u70B9\uFF09"
};
var CN_DIGIT = { \u96F6: 0, \u4E00: 1, \u4E8C: 2, \u4E24: 2, \u4E09: 3, \u56DB: 4, \u4E94: 5, \u516D: 6, \u4E03: 7, \u516B: 8, \u4E5D: 9 };
function cnNumber(s) {
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const m = s.match(/^([一二两三四五六七八九])?(十)?([一二三四五六七八九])?$/);
  if (!m || !m[1] && !m[2] && !m[3]) return null;
  if (!m[2]) return m[1] ? CN_DIGIT[m[1]] : CN_DIGIT[m[3]];
  return (m[1] ? CN_DIGIT[m[1]] : 1) * 10 + (m[3] ? CN_DIGIT[m[3]] : 0);
}
var PRICE_RE = /(?:¥\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?|[一二两三四五六七八九十]{1,3})\s*(?:元|块钱|块(?![\p{L}])))/gu;
var PLACE_RE = /([\p{Script=Han}]{2,4})(?:市|县|区|镇|乡|村)(?![\p{Script=Han}]{0,1}(?:场|长|民|委|政府|级))/gu;
var HONOR_RE = /(?:(\d+|[一二两三四五六七八九十]{1,3})\s*家(?:分店|门店|连锁)|老字号|非遗|获奖|冠军|金奖|排名第一|销量第一|全网第一|全国第一|全市第一|百年老店)/g;
var STAT_RE = /(?:据[^，。！？\n]{0,10}(?:统计|调查|报告|数据)|数据显示|研究表明|调查显示|有数据(?:显示|表明)|权威机构)/g;
var LIFE_SCHEDULE_RE = /我(?:每天|天天|每天早上|每天晚上|每天凌晨)[^，。！？,.!?\n]{0,6}?((?:早上|凌晨|晚上|下午)?[0-9一二三四五六七八九十]{1,3}点)/g;
var LIFE_FAMILY_RE = /我(?:家)?(孩子|儿子|女儿|老婆|媳妇|老公|爸|妈|父母|爷爷|奶奶|姥姥|姥爷)[^，。！？,.!?\n]{0,12}?(?:生病|病了|住院|手术|去世|走了|欠|借钱|学费|上学|考上|毕业|离婚|结婚)/g;
var LIFE_MONEY_RE = /(?:我|我们家)[^，。！？,.!?\n]{0,6}?(欠了|借了|存款|积蓄|贷款)[^，。！？,.!?\n]{0,10}/g;
var CITED_LINE = /来源[：:]|出处[：:]|https?:\/\/|\[\d+\]|【\d+】|\[来源/;
var NOT_PLACE = /^(?:评论|弹幕|直播|后厨|用餐|就餐|等候|办公|休息|商|景|社|小|市|城|老城|新城|开发|功能|服务|片|郊|山|园|校|营业|核心|中心|热门|黄金|繁华|误|盲|雷|禁|灾|重灾|保护|无人|安全|危险|舒适)$/;
var FUNCTION_AREA = /(?:衣|货|台|位|座|架|柜|物|纳|车|诊|餐|厨|洗|浴|卧|厅|房|室|吧|展|陈列|体验|互动|游戏|烟|操作|工作|生活|阅读|休闲|儿童|收银|等候|试|拍照|打卡|候|装|品|料|菜|样|材|具|工)$/;
var PERCENT_RE = /(\d+(?:\.\d+)?)\s*[%％]|百分之[一二两三四五六七八九十百]+|([一二三四五六七八九])成(?=的|以上|左右|多|人|顾客|客|用户|业主|家长|学员|粉丝)/g;
var TESTIMONIAL_RE = /(?:很多|好多|不少|许多|有位|有个|有一位|有一个|一位|一个|上周|昨天|前几天|之前|老)(?:老)?(?:客人|顾客|客户|粉丝|业主|家长|学员|宝妈|会员|食客|买家)(?:都|就|还|专门|特意|跑来|过来)?(?:说|讲|告诉|跟我说|反馈|夸|评价|留言|感叹|吐槽)|(?:客人|顾客|客户|粉丝|业主|家长|学员|食客|买家)(?:都说|纷纷|一致|普遍|常说|总说|反馈说)/g;
var PROMISE_RE = /(?:免费(?:送|赠|领|试|上门|设计|测量|安装|体验|品尝|续|加)|赠送|买[一二两三\d]+送[一二两三\d]+|送[一二两三四五六七八九十\d]+(?:份|个|杯|串|瓶|次|张|件)|包邮|包退|包换|包教包会|包安装|包售后|无效退款|不满意(?:全额)?退|终身(?:保修|维修|免费|质保)|保修[一二两三四五六七八九十\d]+年|打[一二三四五六七八九\d](?:\.\d)?折|满\d+减\d+|优惠券|首单立减|限时特价)/g;
var AREA_NOUN_TAIL = /[误分专园社展示厂景城市郊山地辖片校灾雷盲禁小商街新老营功能用常款式域储收纳候待褥衣柜货售验列]$/;
var SUFFIX_NOUN_TAIL = {
  \u5E02: /[城夜超菜集门早黑股闹上开花]$/,
  \u4E61: /[老家故同下城水他异]$/,
  \u6751: /[乡农山渔新]$/,
  \u9547: /[城坐]$/,
  \u53BF: /[郡州]$/
};
var NEGATION_BEFORE = /没有|不说|不用|别说|避免|不能|禁止|不许|杜绝|去掉|删掉|删除|不写|不提/;
var PRICE_WORD_BEFORE = /价|卖|只要|才|花|收|仅|一共|总共|一份|一串|一碗|一位|人均|起步|元/;
var MIX_LINE = /配比|流量型|人设型|变现型|占比|比例/;
var WARNING_BEFORE = /套路|陷阱|坑|骗|小心|别信|所谓|号称|打着|警惕|假的|忽悠/;
function stripSelfCheck(output) {
  const lines = output.split("\n");
  const keep = [];
  let skipLevel = 0;
  for (const line of lines) {
    const h = line.match(/^\s*(#{1,4})\s+(.*)$/);
    if (h) {
      if (skipLevel && h[1].length <= skipLevel) skipLevel = 0;
      if (!skipLevel && /自检|自查|核对|校验|检查清单|事实确认/.test(h[2])) {
        skipLevel = h[1].length;
        continue;
      }
    }
    if (skipLevel) continue;
    if (/^\s*[-*•]?\s*\**\s*(?:自检|自查|事实核对)\**\s*[：:]/.test(line)) continue;
    keep.push(line);
  }
  return keep.join("\n");
}
var SELF_CERT_RE = /(?:自检(?:已)?通过|已自检|无编造|没有编造|未编造|无虚构|全部(?:属实|真实)|数据(?:均|都)?真实可靠|事实(?:均|都)?已核实)/g;
function knownPrices(known) {
  const out = /* @__PURE__ */ new Set();
  for (const m of known.matchAll(PRICE_RE)) {
    const n = cnNumber(m[1] ?? m[2] ?? "");
    if (n !== null) out.add(n);
  }
  for (const m of known.matchAll(/(?:价格?|人均|客单|消费|套餐|单价|均价|收费|费用|报价|起步)[^，。；\n]{0,12}/g)) {
    for (const d of m[0].matchAll(/\d+(?:\.\d+)?/g)) out.add(Number(d[0]));
  }
  return out;
}
function unsupportedFacts(raw, knownText, opts = {}) {
  const output = stripSelfCheck(raw);
  const known = knownText || "";
  const lineAt = (at) => output.slice(output.lastIndexOf("\n", at - 1) + 1, (output.indexOf("\n", at) + 1 || output.length + 1) - 1);
  const prices = knownPrices(known);
  const knownNumbers = new Set([...known.matchAll(/\d+(?:\.\d+)?|[一二两三四五六七八九十]{1,3}/g)].map((m) => cnNumber(m[0])).filter((n) => n !== null));
  const out = [];
  const near = (at, len) => output.slice(Math.max(0, at - 8), at + len + 4).replace(/\s+/g, " ").trim();
  const inKnown = (s) => s.length >= 2 && known.includes(s);
  if (/尚未采访|还没采访|没有采访(?:素材|结果|实录|回答)|不编造采访答案/.test(known)) {
    for (const m of output.matchAll(/(?:我[^，。！？\n]{0,8})?(?:问了|问过|采访了|走访了)[^，。！？\n“”"]{0,24}/g)) {
      const at = m.index ?? 0;
      const before = output.slice(Math.max(0, at - 16), at);
      if (inKnown(m[0]) || /如果|假设|不要|不能|不得|示例|采访后|采访结束后/.test(before)) continue;
      out.push(`\u91C7\u8BBF\u7ECF\u5386\u300C${m[0]}\u300D\u7528\u6237\u5C1A\u672A\u63D0\u4F9B\u91C7\u8BBF\u7D20\u6750\uFF0C\u8BF7\u6539\u6210\u51C6\u5907\u9A8C\u8BC1\u7684\u95EE\u9898\u6216\u884C\u52A8\uFF0C\u4E0D\u9884\u5199\u53D1\u73B0\u4E0E\u7B54\u6848`);
    }
    const findings = /有人说[^，。！？\n]{1,18}[，,、]有人说[^。！？\n]{1,18}|(?:每家|每个老板|他们|老板们|大家)[^，。！？\n]{0,6}(?:答案|回答|感受)[^，。！？\n]{0,8}(?:不一样|不同|一样|一致)|店里(?:突然|一下子)?(?:安静|冷清|热闹|忙碌)(?:下来|起来|了)/g;
    for (const m of output.matchAll(findings)) {
      const at = m.index ?? 0;
      const before = output.slice(Math.max(0, at - 20), at);
      const after = output.slice(at + m[0].length, at + m[0].length + 6);
      if (inKnown(m[0]) || /如果|假设|可能|也许|不预设|不要|不能|不得/.test(before) || /^(?:吗|呢)?[？?]/.test(after)) continue;
      out.push(`\u91C7\u8BBF\u7ED3\u679C\u300C${m[0]}\u300D\u5C1A\u672A\u63D0\u4F9B\u91C7\u8BBF\u5B9E\u5F55\uFF0C\u4E0D\u80FD\u9884\u8BBE\u53D8\u5316\u6216\u7B54\u6848\uFF0C\u6539\u4E3A\u51C6\u5907\u9A8C\u8BC1\u7684\u95EE\u9898`);
    }
  }
  const marked = (at) => {
    const line = output.slice(output.lastIndexOf("\n", at) + 1, at + 40);
    return /【示例|示例】|【待确认|待确认】|（示例）|\(示例\)/.test(line.slice(0, line.indexOf("\n") >= 0 ? line.indexOf("\n") : void 0));
  };
  if (!opts.light) {
    for (const m of output.matchAll(PRICE_RE)) {
      const n = cnNumber(m[1] ?? m[2] ?? "");
      if (n === null || prices.has(n) || marked(m.index ?? 0)) continue;
      if (m[2] && /^[一二两三四五六七八九十]+$/.test(m[2]) && /块$/.test(m[0]) && !PRICE_WORD_BEFORE.test(output.slice(Math.max(0, (m.index ?? 0) - 6), m.index ?? 0))) continue;
      out.push(`\u4EF7\u683C\u300C${near(m.index ?? 0, m[0].length)}\u300D\u6863\u6848\u548C\u7D20\u6750\u91CC\u90FD\u6CA1\u6709`);
    }
  }
  for (const m of output.matchAll(PERCENT_RE)) {
    if (marked(m.index ?? 0) || MIX_LINE.test(lineAt(m.index ?? 0)) || inKnown(m[0].replace(/\s+/g, "")) || m[1] && new RegExp(`${m[1].replace(".", "\\.")}\\s*[%\uFF05]`).test(known)) continue;
    out.push(`\u767E\u5206\u6BD4\u300C${near(m.index ?? 0, m[0].length)}\u300D\u6CA1\u6709\u51FA\u5904`);
  }
  for (const re of [LIFE_SCHEDULE_RE, LIFE_FAMILY_RE, LIFE_MONEY_RE]) {
    for (const m of output.matchAll(re)) {
      const at = m.index ?? 0;
      if (marked(at) || /X|Ｘ|【换成你的|【待/.test(m[0]) || inKnown(m[1] ?? "") || inKnown(m[0].slice(1, 7))) continue;
      out.push(`\u4E2A\u4EBA\u7ECF\u5386\u300C${near(at, m[0].length)}\u300D\u6863\u6848\u548C\u7D20\u6750\u91CC\u6CA1\u6709\uFF0C\u522B\u5199\u6210\u771F\u4E8B`);
    }
  }
  for (const m of output.matchAll(TESTIMONIAL_RE)) {
    const after = output.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 12).replace(/[：:“”"「」\s]/g, "");
    if (marked(m.index ?? 0) || inKnown(m[0]) || inKnown(after.slice(0, 6))) continue;
    out.push(`\u987E\u5BA2\u89C1\u8BC1\u300C${near(m.index ?? 0, m[0].length + 6)}\u300D\u8D44\u6599\u91CC\u6CA1\u6709\u8FD9\u6BB5\u7ECF\u5386`);
  }
  if (!opts.light) {
    for (const m of output.matchAll(PROMISE_RE)) {
      if (marked(m.index ?? 0) || inKnown(m[0]) || WARNING_BEFORE.test(output.slice(Math.max(0, (m.index ?? 0) - 12), m.index ?? 0))) continue;
      out.push(`\u7ECF\u8425\u627F\u8BFA\u300C${near(m.index ?? 0, m[0].length)}\u300D\u8001\u677F\u6CA1\u8BF4\u8FC7\u8981\u8FD9\u6837\u505A`);
    }
    for (const m of output.matchAll(HONOR_RE)) {
      if (known.includes(m[0]) || m[1] && knownNumbers.has(cnNumber(m[1]) ?? -1) && /分店|门店|连锁/.test(known)) continue;
      if (NEGATION_BEFORE.test(output.slice(Math.max(0, (m.index ?? 0) - 10), m.index ?? 0))) continue;
      out.push(`\u8D44\u5386/\u8363\u8A89\u300C${near(m.index ?? 0, m[0].length)}\u300D\u6863\u6848\u91CC\u6CA1\u6709`);
    }
  }
  for (const m of output.matchAll(STAT_RE)) {
    if (CITED_LINE.test(lineAt(m.index ?? 0))) continue;
    out.push(`\u300C${near(m.index ?? 0, m[0].length)}\u300D\u5F15\u7528\u4E86\u6570\u636E\u4F46\u6CA1\u7ED9\u51FA\u5904`);
  }
  if (!opts.light) {
    const ordinaryPlaces = [...output.matchAll(/县城|返乡|回乡|下乡|家乡|故乡|老乡|同乡|异乡|城乡|乡村|农村|评论区|弹幕区/g)].map((m) => ({ start: m.index, end: m.index + m[0].length }));
    for (const m of output.matchAll(PLACE_RE)) {
      const start = m.index;
      if (ordinaryPlaces.some((span) => start < span.end && start + m[0].length > span.start)) continue;
      const name = m[1];
      const isArea = m[0].endsWith("\u533A");
      const tail = SUFFIX_NOUN_TAIL[m[0].slice(-1)];
      if (tail && tail.test(name)) continue;
      if (NOT_PLACE.test(name) || isArea && (FUNCTION_AREA.test(name) || AREA_NOUN_TAIL.test(name) || name.includes("\u7684")) || known.includes(name) || known.includes(name.slice(-2))) continue;
      out.push(`\u5730\u540D\u300C${m[0]}\u300D\u6863\u6848\u548C\u7D20\u6750\u91CC\u90FD\u6CA1\u6709`);
    }
  }
  const selfCert = [...raw.matchAll(SELF_CERT_RE)].map((m) => `\u6A21\u578B\u81EA\u79F0\u300C${m[0]}\u300D\u2014\u2014\u4EE5\u8FD9\u91CC\u7684\u6838\u5BF9\u4E3A\u51C6\uFF0C\u522B\u4FE1\u8FD9\u53E5`);
  return Array.from(/* @__PURE__ */ new Set([...selfCert.slice(0, 1), ...out])).slice(0, 8);
}
var KINDS = Object.keys(QUALITY_LABELS);

// lib/preferences.ts
var PREFERENCE_CATEGORIES = [
  { id: "tone", label: "\u53E3\u543B\u7528\u8BCD" },
  { id: "opening", label: "\u5F00\u5934\u4E60\u60EF" },
  { id: "structure", label: "\u7ED3\u6784\u4E0E\u957F\u5EA6" },
  { id: "content", label: "\u5185\u5BB9\u53D6\u5411" }
];
var CATEGORY_IDS = new Set(PREFERENCE_CATEGORIES.map((c) => c.id));
function sentences(text2) {
  return (text2.replace(/\r/g, "").match(/[^。！？!?\n]+[。！？!?]*|\n/g) ?? []).map((s) => s.trim()).filter((s) => s && s !== "\n");
}

// lib/opening-cards.ts
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
var BY_NAME = new Map(OPENING_CARDS.map((c) => [c.name, c]));

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

// lib/deal-reasons.ts
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

// lib/creation-settings.ts
var SCRIPT_TYPE_LABELS = Object.fromEntries(Object.entries(SCRIPT_TYPES).map(([id, value]) => [id, value.label]));

// lib/fact-fix.ts
var FACT_FIX_CONTEXT_MAX_CHARS = 2e4;
var FACT_FIX_MIN_KEPT = 0.8;
function buildFactFixPrompt(p) {
  const ctx = p.context?.trim() ? `\u3010\u672C\u6761\u521B\u4F5C\u539F\u610F\u3001\u7528\u6237\u6750\u6599\u4E0E\u8D26\u53F7\u80CC\u666F\u3011
${p.context.trim().slice(0, FACT_FIX_CONTEXT_MAX_CHARS)}

` : "";
  return `\u3010\u9AD8\u9636\u81EA\u7531\u5BF9\u8BDD\u3011${ctx}\u3010\u4EFB\u52A1\u3011\u4E0B\u9762\u8FD9\u4EFD\u7A3F\u5B50\u91CC\uFF0C\u6709\u51E0\u5904\u8BF4\u6CD5\u5728\u8D26\u53F7\u8D44\u6599\u548C\u7D20\u6750\u91CC\u627E\u4E0D\u5230\u51FA\u5904\u3002**\u53EA\u6539\u8FD9\u51E0\u5904**\uFF0C\u5176\u4F59\u5185\u5BB9\u4E00\u4E2A\u5B57\u90FD\u4E0D\u8981\u52A8\u3002

\u3010\u8981\u6539\u7684\u51E0\u5904\u3011
${p.issues.map((i, n) => `${n + 1}. ${i}`).join("\n")}

\u3010\u600E\u4E48\u6539\uFF0C\u6309\u60C5\u51B5\u9009\u4E00\u79CD\u3011
- \u6838\u5BF9\u63D0\u9192\u53EF\u80FD\u8BEF\u5224\u3002\u53BF\u57CE\u3001\u8FD4\u4E61\u3001\u8BC4\u8BBA\u533A\u7B49\u666E\u901A\u8BCD\u4E0D\u662F\u5177\u4F53\u5730\u540D\uFF1B\u7528\u6237\u5DF2\u7ED9\u51FA\u7684\u4E3B\u9898\u3001\u4EBA\u7FA4\u3001\u7ACB\u573A\u548C\u9650\u5236\u5FC5\u987B\u4FDD\u7559\uFF0C\u4E0D\u80FD\u628A\u5177\u4F53\u4E3B\u9898\u6CDB\u5316\u6210\u201C\u8FD9\u4E2A\u9009\u62E9\u201D\uFF0C\u4E0D\u80FD\u628A\u8BA8\u8BBA\u6539\u6210\u4FC3\u9500\u3002\u63D0\u793A\u8BEF\u62A5\u6216\u5DF2\u6709\u7528\u6237\u6750\u6599\u4F9D\u636E\u7684\u53E5\u5B50\u4FDD\u6301\u539F\u6837\u3002
- \u7F16\u51FA\u6765\u7684\u4EF7\u683C\u3001\u767E\u5206\u6BD4\u3001\u5206\u5E97\u6570\u3001\u83B7\u5956\uFF1A\u5220\u6389\u6570\u5B57\uFF0C\u6362\u6210\u4E0D\u5E26\u6570\u5B57\u7684\u8BF4\u6CD5\uFF08\u300C\u4EBA\u5747 68 \u5143\u300D\u2192\u300C\u4EF7\u683C\u5F88\u4EB2\u6C11\u300D\uFF0C\u300C90% \u7684\u4EBA\u300D\u2192\u300C\u4E0D\u5C11\u4EBA\u300D\uFF09
- \u7F16\u51FA\u6765\u7684\u987E\u5BA2\u89C1\u8BC1\uFF08\u300C\u6709\u4F4D\u987E\u5BA2\u8BF4\u2026\u2026\u300D\u300C\u5F88\u591A\u5BA2\u4EBA\u90FD\u8BF4\u2026\u2026\u300D\uFF09\uFF1A\u5220\u6389\uFF0C\u6216\u6539\u6210\u8001\u677F\u81EA\u5DF1\u7684\u8BDD\uFF08\u300C\u6211\u81EA\u5DF1\u6700\u5E38\u63A8\u8350\u2026\u2026\u300D\uFF09
- \u8001\u677F\u6CA1\u8BF4\u8FC7\u7684\u7ECF\u8425\u627F\u8BFA\uFF08\u9001\u3001\u5305\u3001\u4FDD\u8BC1\u3001\u6253\u6298\uFF09\uFF1A\u5220\u6389
- \u7528\u6237\u5C1A\u672A\u63D0\u4F9B\u91C7\u8BBF\u7D20\u6750\u5374\u5199\u6210\u300C\u95EE\u4E86\u4E00\u5708/\u91C7\u8BBF\u4E86/\u53D1\u73B0\u5927\u5BB6\u90FD\u2026\u300D\u7684\u91C7\u8BBF\u7ECF\u5386\uFF1A\u6807\u9898\u548C\u5F00\u5934\u6539\u6210\u51C6\u5907\u9A8C\u8BC1\u7684\u95EE\u9898\u6216\u51C6\u5907\u53BB\u95EE\u7684\u884C\u52A8\uFF0C\u5220\u6389\u5DF2\u83B7\u7B54\u6848\u3001\u4EBA\u6570\u548C\u53D1\u73B0\uFF1B\u4FDD\u7559\u539F\u4E3B\u9898\u3001\u5177\u4F53\u4E3B\u95EE\u9898\u3001\u8FFD\u95EE\u3001\u524D\u540E\u6BD4\u8F83\u4E0E\u53D6\u6750\u5B89\u6392\u3002
- \u88AB\u6807\u51FA\u7684\u9884\u8BBE\u91C7\u8BBF\u7ED3\u679C\uFF08\u5982\u201C\u6BCF\u5BB6\u7B54\u6848\u4E0D\u4E00\u6837\u201D\u201C\u6709\u4EBA\u8BF4\u56DE\u6696\u6709\u4EBA\u8BF4\u51B7\u6E05\u201D\u201C\u5E97\u91CC\u7A81\u7136\u5B89\u9759\u4E0B\u6765\u201D\uFF09\uFF1A\u6CA1\u6709\u539F\u59CB\u7528\u6237\u5B9E\u5F55\u652F\u6301\u65F6\u6539\u6210\u95EE\u9898\u6216\u5F85\u9A8C\u8BC1\u884C\u52A8\uFF0C\u4E0D\u80FD\u53EA\u52A0\u201C\u91C7\u8BBF\u540E\u53EF\u7528\u201D\u5C31\u7EE7\u7EED\u9884\u5199\u4E8B\u5B9E\uFF0C\u4E5F\u4E0D\u8981\u79FB\u5230\u53E6\u4E00\u5904\u3002
- \u786E\u5B9E\u9700\u8981\u5177\u4F53\u6570\u5B57\u7684\u5730\u65B9\uFF1A\u7528\u3010\u5F85\u786E\u8BA4\uFF1A\u8FD9\u91CC\u586B\u2026\u2026\u3011\u5360\u4F4D\uFF0C\u8BA9\u7528\u6237\u81EA\u5DF1\u586B
- \u6A21\u578B\u81EA\u79F0\u300C\u81EA\u68C0\u901A\u8FC7\u3001\u65E0\u7F16\u9020\u300D\u8FD9\u7C7B\u8BDD\uFF1A\u5220\u6389
- \u8D26\u53F7\u80CC\u666F\u91CC\u6709\u5BF9\u5E94\u4E8B\u5B9E\u7684\uFF1A\u6539\u6210\u80CC\u666F\u91CC\u7684\u8BF4\u6CD5

\u3010\u539F\u7A3F\u3011
${p.text}

\u3010\u8F93\u51FA\u3011\u53EA\u8F93\u51FA\u6539\u597D\u540E\u7684\u5B8C\u6574\u7A3F\u5B50\uFF0C\u7ED3\u6784\u3001\u683C\u5F0F\u3001\u672A\u88AB\u6807\u51FA\u7684\u5185\u5BB9\u4FDD\u6301\u539F\u6837\u3002\u6807\u9898\u88AB\u6807\u4E3A\u865A\u5047\u7ECF\u5386\u65F6\u4E5F\u8981\u6539\u6210\u5F85\u9A8C\u8BC1\u7684\u95EE\u9898\u3002\u4E0D\u8981\u89E3\u91CA\u4F60\u6539\u4E86\u4EC0\u4E48\uFF0C\u4E0D\u8981\u52A0\u5F00\u573A\u767D\uFF0C\u4E0D\u8981\u7528\u4EE3\u7801\u5757\u5305\u8D77\u6765\u3002`;
}
var norm = (s) => s.replace(/[\s\p{P}\p{S}]/gu, "");
function flaggedParts(issues) {
  return issues.flatMap((i) => [...i.matchAll(/「([^」]+)」/g)].map((m) => m[1])).flatMap((s) => s.split(/[，。！？、；：,.!?;:#…\n]+/)).map(norm).filter((s) => s.length >= 3);
}
function fixTooBig(before, after, issues) {
  const parts = flaggedParts(issues);
  const unflagged = sentences(before).filter((s) => {
    const n = norm(s);
    return n.length > 0 && !parts.some((p) => n.includes(p) || p.includes(n));
  });
  if (!unflagged.length) return false;
  const out = norm(after);
  const kept = unflagged.filter((s) => out.includes(norm(s))).length;
  return kept / unflagged.length < FACT_FIX_MIN_KEPT;
}

// lib/canvas.ts
function cleanRewriteOutput(text2) {
  let t = text2.trim();
  const fence = t.match(/^```[\w-]*\n([\s\S]*?)\n```$/);
  if (fence) t = fence[1].trim();
  t = t.replace(/^(?:好的[，,。！!]?\s*)?(?:改写|修改|优化)(?:后|好)(?:的)?(?:这一段|内容|版本|稿子)?(?:如下)?[：:]\s*\n?/, "");
  return t.trim();
}

// lib/self-cert.ts
var CLAIM = /(?:自检|自查|安全核查|合规核查|事实核查|核查|检查|核对)(?:已)?通过|无编造|没有编造|未编造|无虚构|没有虚构|未虚构|全部(?:属实|真实)|数据(?:均|都)?真实可靠|事实(?:均|都)?已核实/;
var SECTION_TITLE = /自检|自查|安全核查|合规(?:检查|核查)|事实(?:核查|核对)|质量自评/;
function stripSelfCert(text2) {
  if (!text2 || !CLAIM.test(text2) && !/^\s*#{1,4}\s+.*(?:自检|自查|安全核查)/m.test(text2)) return text2;
  const lines = text2.split("\n");
  const out = [];
  let skipList = false;
  let skipSection = 0;
  for (const line of lines) {
    const heading = line.match(/^\s*(#{1,4})\s+(.*)$/);
    if (heading) {
      if (skipSection && heading[1].length <= skipSection) skipSection = 0;
      if (!skipSection && SECTION_TITLE.test(heading[2])) {
        skipSection = heading[1].length;
        continue;
      }
    }
    if (skipSection) continue;
    const bare = line.replace(/[*_`>#✅☑️✔️\s]/gu, "");
    const isList = /^\s*(?:[-*•]|\d+[.、)])\s+/.test(line);
    if (skipList) {
      if (isList || !bare) {
        if (isList) continue;
      } else skipList = false;
    }
    if (bare && CLAIM.test(bare) && bare.replace(CLAIM, "").replace(/[：:，,。！!、（）()【】]/g, "").length <= 6) {
      skipList = true;
      continue;
    }
    if (bare && SECTION_TITLE.test(bare) && /[：:]$/.test(bare) && bare.length <= 14) {
      skipList = true;
      continue;
    }
    out.push(CLAIM.test(line) ? line.replace(new RegExp(`[\uFF0C,\u3001\uFF1B;]?\\s*(?:${CLAIM.source})[^\uFF0C,\u3002\uFF01!\uFF1B;\\n]{0,8}[\u3002.\uFF01!]?`, "g"), "").replace(/\s+$/, "") : line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\n+---\s*$/, "").trim();
}

// .tmp/craft-repair-probe_20261007.ts
for (const line of import_node_fs.default.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
}
var dir = "docs/\u521B\u4F5C\u8D28\u91CF\u540C\u7C7B\u4FEE\u590D_20261007";
var round = JSON.parse(import_node_fs.default.readFileSync(dir + "/\u7B2C\u4E8C\u8F6E\u6B63\u5F0F\u6A21\u578B\u9A8C\u6536.json", "utf8"));
var goal = "\u56FD\u5E86\u524D\u540E\u95E8\u5E97\u751F\u610F\u5BF9\u6BD4\uFF0C\u95EE\u6BCF\u5BB6\u8001\u677F\u771F\u5B9E\u611F\u53D7\uFF0C\u5168\u56FD\u5B9E\u4F53\u5E97\u8001\u677F\u613F\u610F\u770B\u548C\u8BA8\u8BBA\u3002\u4E0D\u5356\u8BFE\uFF0C\u4E0D\u79C1\u4FE1\u83B7\u5BA2\u3002\u5C1A\u672A\u91C7\u8BBF\uFF0C\u6CA1\u6709\u5B9E\u5F55\u3001\u6570\u5B57\u3001\u5DF2\u77E5\u7B54\u6848\u3002\u4E00\u4EBA\uFF0C\u624B\u673A\u548C\u9886\u5939\u9EA6\u3002";
var results = [];
async function run(id) {
  const row = round.results.find((r) => r.id === id);
  const text2 = stripSelfCert(row.answer);
  const issues = unsupportedFacts(text2, goal);
  console.log(JSON.stringify({ id, issues: issues.length, started: true }));
  const start = Date.now();
  const answer = await askDify(buildFactFixPrompt({ text: text2, issues: issues.slice(0, 8), context: goal }), "kaiwu-craft-repair-synthetic-20261007-" + id, "", { signal: AbortSignal.timeout(3e5) });
  const fixed = answer.ok ? stripSelfCert(cleanRewriteOutput(answer.text)) : "";
  const result = { id, ok: answer.ok, accepted: answer.ok && !fixTooBig(text2, fixed, issues.slice(0, 8)), elapsedMs: Date.now() - start, before: text2, issues, after: fixed, remaining: fixed ? unsupportedFacts(fixed, goal) : [], error: answer.ok ? null : answer.message };
  results.push(result);
  import_node_fs.default.writeFileSync(dir + "/\u81EA\u52A8\u4FEE\u6B63\u6B63\u5F0F\u5B9E\u6D4B.json", JSON.stringify({ scope: "\u6B63\u5F0F\u6A21\u578B\u8C03\u7528\uFF1B\u6A21\u62DF\u7F51\u9875\u5B9E\u9645\u7684\u68C0\u6D4B-\u4FEE\u6B63-\u6539\u52A8\u8303\u56F4\u9A8C\u8BC1\uFF0C\u4E0D\u5192\u5145\u6D4F\u89C8\u5668\u4EA4\u4E92\uFF0C\u4E0D\u5199\u4E1A\u52A1\u5386\u53F2", results }, null, 2));
  console.log(JSON.stringify({ id, ok: result.ok, accepted: result.accepted, remaining: result.remaining, elapsedMs: result.elapsedMs }));
}
Promise.all(["direction_single", "opening_interview", "title_interview"].map(run)).catch(() => {
  console.error("repair probe failed; credentials not logged");
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
