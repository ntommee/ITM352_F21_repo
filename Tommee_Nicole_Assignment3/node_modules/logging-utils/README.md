# logging-utils v4.0.25
Utilities for configuring simple log level based logging functionality on an object.

The log levels supported are the following:
- **ERROR** - only logs error messages
- **WARN** - only logs warning and error messages
- **INFO** - logs info, warning and error messages
- **DEBUG** - logs debug, info, warning and error messages
- **TRACE** - logs trace, debug, info, warning and error messages (i.e. all)

Main module:
- logging.js

This module is exported as a [Node.js](https://nodejs.org) module.

## Installation

Using npm:
```bash
$ npm i --save logging-utils
```

## Usage

### 1. Configure logging:

1. Require logging-utils
```js
// To use the logging utilities
const logging = require('logging-utils');

// Valid logging levels
const LogLevel = logging.LogLevel; 

// Logging configuration functions
const isLoggingConfigured = logging.isLoggingConfigured;
const configureLogging = logging.configureLogging;

// Convenience logging function
const log = logging.log;
```
2. Provide a context object on which to configure logging, e.g:
```js
const context = {}; // replace with your own target object to be configured
```
3. Configure logging on the context object

* To configure default logging on an existing object (WITHOUT overriding any existing logging on context)
```js
configureLogging(context);
// which is equivalent to:
configureLogging(context, {logLevel: LogLevel.INFO});
```
* To configure WARN level logging on an existing object (WITHOUT overriding any existing logging on context)
```js
configureLogging(context, {logLevel: LogLevel.WARN});
```
* To configure specific logging (WITHOUT overriding any existing logging on context)
```js
const settings = {logLevel: LogLevel.DEBUG, useLevelPrefixes: false, useConsoleTrace: false, underlyingLogger: console}; // or your own settings
configureLogging(context, settings);
// OR with explicit forceConfiguration false
configureLogging(context, settings, undefined, false);
```
* To configure specific logging (OVERRIDING any existing logging on context!)
```js
configureLogging(context, settings, undefined, true);
```

* To configure default logging on a new object
```js
const log = configureLogging({});
```
* To configure default logging on an existing object with overriding options and forceConfiguration true
```js
configureLogging(context, undefined, options, true);
// Alternatively ...
configureLogging(context, options, undefined, true);
```
* To configure default logging on an existing object with overriding options, an explicit logger and forceConfiguration true
```js
const options = undefined; // ... or any LoggingOptions you want to use to partially or fully override the default logging settings
configureLogging(context, {underlyingLogger: console}, options);
const CustomLogger = {/* ... */}; // implement your own custom logger if required
configureLogging(context, {underlyingLogger: CustomLogger}, options, true);
```

* To configure logging from options
```js
const options = { logLevel: LogLevel.DEBUG, useLevelPrefixes: true, useConsoleTrace: false }; // replace with your own options
configureLogging(context, undefined, options);
// OR just ...
configureLogging(context, options);
```

* To configure logging from EITHER logging settings OR logging options (OR defaults if neither) - WITHOUT overriding any existing logging on context
```js
configureLogging(context, settings, options);
// OR with explicit forceConfiguration false ...
configureLogging(context, settings, options, false);
```

* To configure logging from EITHER logging settings OR logging options (OR defaults if neither) - OVERRIDING any existing logging on context!
```js
configureLogging(context, settings, options, true);
```

* To **OVERRIDE** any pre-configured `logLevel` setting or option during runtime configuration, set a logging level on 
 the environment variable named by the `envLogLevelName` setting, which is also configurable and defaults to `'LOG_LEVEL'`. 
 Any valid `logLevel` found with `process.env[envLogLevelName]` will take precedence over any other `logLevel` setting or option.
```js
// For unit testing, set the `LOG_LEVEL` environment variable programmatically
process.env.LOG_LEVEL = LogLevel.DEBUG;

// Alternatively, if you configured your own `envLogLevelName` as 'MyLogLevel', e.g.
configureLogging(context, {envLogLevelName: 'MyLogLevel'});
// then for unit testing, set your `MyLogLevel` environment variable programmatically
process.env.MyLogLevel = LogLevel.TRACE;
```  
  
### 2. Log messages

* To log errors:
```js
// Log an error with a strack trace
context.error('Error message 1', new Error('Boom'));

// Log an error without a stack trace
context.error('Error message 2');
```
* To log warnings:
```js
// Log a warning (or do nothing when warnings are disabled)
context.warn('Warning message 1');

// To avoid building the warning message (when warnings are disabled)
if (context.warnEnabled) context.warn('Warning message 2');
```
* To log info messages:
```js
// Log an info message (or do nothing when info messages are disabled)
context.info('Info message 1');

// To avoid building the info message (when info messages are disabled)
if (context.infoEnabled) context.info('Info message 2');
```
* To log debug messages:
```js
// Log a debug message (or do nothing when debug messages are disabled)
context.debug('Debug message 1');

// To avoid building the debug message (when debug messages are disabled)
if (context.debugEnabled) context.debug('Debug message 2');
```
* To log trace messages:
```js
// To log a trace message (or do nothing when trace messages are disabled)
context.trace('Trace message 1');

// To avoid building the trace message (when trace messages are disabled)
if (context.traceEnabled) context.trace('Trace message 2');
```

* To log messages at a specified log level (using the `log` method):
```js
// To log a message at LogLevel.TRACE (or do nothing when trace messages are disabled)
context.log(LogLevel.ERROR, 'Error message 1', new Error('Boom'));

// Note that this will also work with console, but you won't get any suppression according to log level
console.log(LogLevel.TRACE, 'Trace message 1');
```

* To log messages at a specified log level (using the `log` function):
```js
// Alternatively using log function
log(context, LogLevel.DEBUG, 'Debug message 1');

// Note that this will also work with console (and undefined), but you won't get any suppression according to log level
log(console, LogLevel.WARN, 'Warn message 1');
log(undefined, LogLevel.ERROR, 'Error message 1', new Error('Boom 2'));
```

## Unit tests
This module's unit tests were developed with and must be run with [tape](https://www.npmjs.com/package/tape). The unit tests have been tested on [Node.js v6.10.3](https://nodejs.org/en/blog/release/v6.10.3).  

See the [package source](https://github.com/byron-dupreez/logging-utils) for more details.

## Changes
See [CHANGES.md](./CHANGES.md)