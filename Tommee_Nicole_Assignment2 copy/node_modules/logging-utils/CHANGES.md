## Changes

### 4.0.25
- Updated dependencies

### 4.0.24
- Updated dependencies

### 4.0.23
- Added `.npmignore`
- Renamed `release_notes.md` to `CHANGES.md`
- Updated dependencies

### 4.0.22
- Updated `core-functions` dependency to version 3.0.22

### 4.0.21
- Updated `core-functions` dependency to version 3.0.21

### 4.0.20
- Updated `core-functions` dependency to version 3.0.20

### 4.0.19
- Renamed dummy first exports (`exports._ = '_'; //IDE workaround`) of most modules to (`exports._$_ = '_$_';`) to avoid 
  potential future collisions with `lodash` & `underscore`
- Updated `core-functions` dependency to version 3.0.19

### 4.0.18
- Updated `core-functions` dependency to version 3.0.18

### 4.0.17
- Updated `core-functions` dependency to version 3.0.17

### 4.0.16
- Changed all logging functions to be able to use level prefixes even when the first argument is NOT a string
- Bound all logging functions to their logger to facilitate their use even when invoked as "detached" functions
- Changed the extended `log` function to invoke `log.apply` using `this` (if defined) or the target to which it was 
  added (if not) as `thisArg` to avoid errors when the extended `log` function is invoked as a "detached" function
- Changed `log` method & function to attempt to extract a log level prefix from the first argument & when successful to 
  then use the rest of the first argument as the first argument
- Added zero arguments length check to `log` function to avoid errors when invoked without any arguments
- Updated `core-functions` dependency to version 3.0.16

### 4.0.14
- Replaced all logging of `error.stack` with logging of just the error
- Updated `core-functions` dependency to version 3.0.15

### 4.0.13
- Added dummy first export (`exports._ = '_'; //IDE workaround`) to `logging` module as a temporary workaround for IDE issue

### 4.0.12
- Changed all exports to modifications of the default `exports` object instead of replacing the default object
- Updated `core-functions` dependency to version 3.0.13

### 4.0.11
- Updated `core-functions` dependency to version 3.0.11

### 4.0.10
- Updated `core-functions` dependency to version 3.0.10

### 4.0.9
- Updated `core-functions` dependency to version 3.0.9

### 4.0.8
- Updated `core-functions` dependency to version 3.0.8

### 4.0.7
- Moved test devDependencies to package.json & removed test/package.json
- Updated `core-functions` dependency to version 3.0.7

### 4.0.6
- Changed `isLoggingConfigured` function to check for non-defined `target` argument

### 4.0.5
- Updated `core-functions` dependency to version 3.0.6
- Fixed wrong version number in `test/package.json`

### 4.0.4
- Updated `core-functions` dependency to version 3.0.5

### 4.0.3
- Upgraded to Node 6.10.3
- Updated `core-functions` dependency to version 3.0.4

### 4.0.2
- Updated `core-functions` dependency to version 3.0.3
  
### 4.0.1
- Updated `core-functions` dependency to version 3.0.2
  
### 4.0.0
- Major changes to and simplification of `logging.js` API (NOT BACKWARD COMPATIBLE!):
  - Removed `underlyingLogger` parameter from `configureLogging` function, which was ignored when `settings` were 
    provided and was also redundant, since it can be set via the `settings` parameter
  - Removed redundant `configureLoggingWithSettings`, `configureDefaultLogging` and `getDefaultLoggingSettings` functions
  - Replaced `ERROR`, `WARN`, `INFO`, `DEBUG` and `TRACE` constants with properties in new `LogLevel` constant to 
    simplify import & usage and changed their values to uppercase for consistency
  - Removed `toValidLogLevelOrDefault` function
  - Renamed `Logging` typedef to `Logger`
  - Added additional `log` method to the target object during `configureLogging` to enable logging at a specified level
  - Added `log` function, which delegates to new `log` method to enable logging at a specified level
  - Exported `isValidLogLevel` and new `cleanLogLevel` functions
- Added an `envLogLevelName` setting to enable configuration of the name of the environment variable in which to look 
  for a logLevel on `process.env` (defaults to 'LOG_LEVEL' if undefined)
- Enabled overriding of configured logLevel via `process.env[envLogLevelName]`, where `envLogLevelName` refers to the 
  configured name of the environment variable in which to look for a logLevel on `process.env`
- Updated `core-functions` dependency to version 3.0.0
  
### 3.0.12
- Updated `core-functions` dependency to version 2.0.14
  
### 3.0.11
- Updated `core-functions` dependency to version 2.0.13
  
### 3.0.10
- Updated `core-functions` dependency to version 2.0.12
  
### 3.0.9
- Improved `LoggingSettings` & `LoggingOptions` typedefs in `type-defs.js` module

### 3.0.8
- Moved all typedefs from `logging.js` module to new `type-defs.js` module

### 3.0.7
- Added `Logging` typedef
- Changed return types of `configureLogging`, `configureLoggingWithSettings` and `configureDefaultLogging` functions 
  to new `Logging` type
 
### 3.0.6
- Updated `core-functions` dependency to version 2.0.11

### 3.0.5
- Changed 'Logging was configured without settings or options' warning to use `JSON.stringify` instead of 
  `Strings.stringify` to avoid verbose logging of all of `console` object's properties and functions
  
### 3.0.4
- Updated `core-functions` dependency to version 2.0.10

### 3.0.3
- Updated `core-functions` dependency to version 2.0.9

### 3.0.2
- Updated `core-functions` dependency to version 2.0.8

### 3.0.1
- Updated `core-functions` dependency to version 2.0.7
- Updated `tape` dependency to 4.6.3

### 3.0.0
- Changes to `logging.js` module:
  - Renamed `configureLogging` function to `configureLoggingWithSettings`
  - Renamed `configureLoggingWithSettingsOrOptions` function to `configureLogging`
  - Removed `configureLoggingIfNotConfigured` function
- Updated `core-functions` dependency to version 2.0.5

### 2.0.4
- Changes to `logging.js` module:
  - Added new `configureLoggingWithSettingsOrOptions` function to simplify programmatic configuration
  
### 2.0.3
- Changes to `logging.js` module:
  - Added missing return value to `configureLoggingIfNotConfigured` function

### 2.0.2
- Changes to `logging.js` module:
  - Added a convenience `configureLoggingIfNotConfigured` function

### 2.0.1
- Changes to `logging.js` module:
  - Changed `configureDefaultLogging` function to accept a new `options` argument of type `LoggingOptions` 
    to enable optional, partial overriding of default logging settings
  - Renamed `getLoggingSettingsOrDefaults` function to `getDefaultLoggingSettings`

### 2.0.0
- Changed `logging-utils` configuration API to synchronize with similar changes done to `aws-core-utils/stages` 
  configuration and `aws-stream-consumer/stream-processing` configuration.
  - Changed `configureLogging` function API to replace multiple arguments with single `settings` argument
  - Added `getLoggingSettingsOrDefaults` function to facilitate overriding default settings
  - Changed `configureDefaultLogging` function to use new `getLoggingSettingsOrDefaults` function
  - Added typedefs for `LoggingSettings` and `LoggingOptions` to better define parameter and return types
  - Removed obsolete `configureLoggingFromConfig` function
  - Removed obsolete `finaliseLogLevel`, `finaliseUseLevelPrefixes` and `finaliseUseConsoleTrace` functions
  - Removed `defaultLogLevel`, `defaultUseLevelPrefixes` and `defaultUseConsoleTrace` properties & config.json settings 
  - Fixed unit tests to synchronize with API changes
- Renamed `logging-utils` module to `logging` module.
  
### 1.0.6
- Updated `core-functions` dependency to version 2.0.3

### 1.0.5
- Updated `core-functions` dependency to version 2.0.2

### 1.0.4
- Added optional `underlyingLogger` and `forceConfiguration` arguments to the `configureDefaultLogging` function
- Added a new `configureLoggingFromConfig` function to simplify configuring from a config object/file 
- Added unit tests for `configureDefaultLogging` and `configureLoggingFromConfig` functions
- Updated `core-functions` dependency to version 2.0.1

### 1.0.3
- Removed dependency on and replaced usage of `core-functions/functions` functions with standard JS functionality
- Updated `core-functions` dependency to version 2.0.0

### 1.0.2
- Added an explicit `configureDefaultLogging` function for clarity.
- Minor JSDoc updates
- Updated core-functions dependency to 1.2.0

### 1.0.1
- Simply set core-functions dependency to 1.1.1