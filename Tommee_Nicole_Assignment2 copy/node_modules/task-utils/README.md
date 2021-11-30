# task-utils v7.0.7

Utilities for defining task states, creating task and sub-task definitions, creating & configuring a task factory, 
creating tasks (and their sub-tasks) from these definitions and managing tasks on a tasks-by-name map object.

These modules provide a way to attach tasks to objects that can be executed and used to track the state and number of 
attempts at each task.

Tasks are root/top-level, executable, self-managed tasks (with a configurable execute function), whereas sub-tasks can 
be either executable, self managed tasks (with their own configurable execute functions) or non-executable, externally 
managed tasks whose states must be managed completely by the execute function of their parent task.

Currently includes:
- core.js 
  - A core module containing enum objects such as `ReturnMode` and error subclasses for specific errors that can be
    thrown when executing a Task.
- task-states.js 
  - A TaskState class and its subclasses with static utilities for defining the state of a task or operation.
- task-defs.js 
  - A TaskDef class with static utilities for creating task definitions and sub-task definitions, which can be used to 
    define new executable tasks and both executable and non-executable sub-tasks.
- task-factory.js
  - A Task factory class for creating executable tasks and both executable and non-executable sub-tasks that can be used
    to track the state of tasks or operations.
- tasks.js 
  - A Task class that represents an executable task or an executable or non-executable sub-task that can be used to 
    track the state of a task or operation.
- task-utils.js 
  - Utilities for accessing and managing tasks and sub-tasks stored in a "tasks-by-name" map object and for constructing
    and configuring a task factory on a context.

This module is exported as a [Node.js](https://nodejs.org) module.

## Installation

Using npm:
```bash
$ {sudo -H} npm i -g npm
$ npm i --save task-utils
```

In Node.js:

* To use the task-related enums & errors
```js
const core = require('task-utils/core');
// Enums
const StateType = core.StateType;
const ReturnMode = core.ReturnMode;
// Task-related errors
const TimeoutError = core.TimeoutError;
const FrozenError = core.FrozenError;
const FinalisedError = core.FinalisedError;

assert(StateType && ReturnMode && TimeoutError && FrozenError && FinalisedError);
```
* To use the task state classes and subclasses
```js
const states = require('task-utils/task-states');
// TaskState constructor
const TaskState = states.TaskState;

// TaskState direct subclasses
const Unstarted = states.Unstarted; // rather use TaskState.instances.Unstarted singleton
const Started = states.Started; // rather use TaskState.instances.Started singleton
const CompletedState = states.CompletedState;
const TimedOutState = states.TimedOutState;
const FailedState = states.FailedState;
const RejectedState = states.RejectedState;

// CompletedState subclasses
const Completed = states.Completed; // rather use TaskState.instances.Completed singleton
const Succeeded = states.Succeeded; // rather use TaskState.instances.Succeeded singleton

// TimedOutState subclasses
const TimedOut = states.TimedOut;

// FailedState subclasses
const Failed = states.Failed;

// RejectedState subclasses
const Rejected = states.Rejected;
const Discarded = states.Discarded;
const Abandoned = states.Abandoned;

// Example unstarted state
const unstarted = TaskState.instances.Unstarted; // or more wasteful: new Unstarted();

// Example started state
const started = TaskState.instances.Started; // or more wasteful: new Started();

// Example completed states
const completed = TaskState.instances.Completed; // or more wasteful: new Completed();
const succeeded = TaskState.instances.Succeeded; // or more wasteful: new Succeeded();

const customCompletedState = new CompletedState('MyCompletedState');

// Example timed out states
const timedOut = new TimedOut();
const timedOut2 = new TimedOut(new Error('My optional error that triggered timeout ...'));

const customTimedOutState = new TimedOutState('MyTimedOutState');
const customTimedOutState2 = new TimedOutState('MyTimedOutState', new TimeoutError('My optional error that triggered timeout ...'));

// Example failed states
const failed = new Failed(new Error('Another error'));

const customFailedState = new FailedState('MyFailedState', new Error('Kaboom'));

// Example rejected states
const rejected = new Rejected('My reason for rejecting', new Error('My optional error that triggered reject ...'));
const discarded = new Discarded('My reason for discarding');
const abandoned = new Abandoned('My reason for abandoning');

const customRejectedState = new RejectedState('MyRejectionState', 'My reason for rejecting', new Error('My optional error'));

assert(Unstarted && Started && Completed && Succeeded && unstarted && started && completed && succeeded && 
  customCompletedState && timedOut && timedOut2 && customTimedOutState && customTimedOutState2 && failed && 
  customFailedState && rejected && discarded && abandoned && customRejectedState);
```

* To use the task definition class (TaskDef)
```js
const TaskDef = require('task-utils/task-defs');

// To create a new top-level task definition
const taskADef = TaskDef.defineTask('TaskA', execute);

// ... with 3 sub-task definitions
const subTaskA1Def = taskADef.defineSubTask('SubTaskA1', execute2); // executable sub-task
const subTaskDefs = taskADef.defineSubTasks(['SubTaskA2', 'SubTaskA3']); // non-executable, managed sub-tasks

// ... and with 1 sub-sub-task on SubTaskA1
const subSubTaskA1aDef = subTaskA1Def.defineSubTask('SubSubTaskA1a');

assert(subTaskDefs, subSubTaskA1aDef);
```

* To use the task class (Task) & task factory (TaskFactory)
```js
// First import the TaskFactory & Task classes
const TaskFactory = require('task-utils/task-factory');
const Task = require('task-utils/tasks');

const settings = {logger: console, describeItem: undefined}; // or, better yet, use a logger created using `logging-utils` module
const options = {returnMode: ReturnMode.NORMAL}; // or just undefined or {} to use the same default returnMode
  // OR use: {returnMode: ReturnMode.PROMISE} to change default `execute` behaviour to only return Promises 
  // OR use: {returnMode: ReturnMode.SUCCESS_OR_FAILURE} to change default `execute` behaviour to only return Success or Failure outcomes
const taskFactory = new TaskFactory(settings, options); // or better yet, use `taskUtils.configureTaskFactory` (see below)

// To create a new task (and any & all of its sub-tasks)
// e.g. using task definition taskADef as defined above, this would create a new task (named TaskA) 
// with 3 new sub-tasks (named SubTaskA1, SubTaskA2 & SubTaskA3) under the new task  
// and 1 new sub-sub-task (named SubSubTaskA1a) under sub-task SubTaskA1
const taskOpts = {}; // use this to set the task's optional `returnMode` property, which if set will override the factory's `returnMode` property for this task
const taskA = taskFactory.createTask(taskADef, taskOpts);

assert(Task && taskA);
```

* To use the task utilities to configure a task factory on any context object
```js
const taskUtils = require('task-utils');

const context = {}; // or your own context object (preferably configured as a logger too using logging-utils)
const settings = {createTaskFactory: undefined, logger: console, describeItem: undefined}; // use this to define your own custom `createTaskFactory` function to be used
const options = {returnMode: undefined}; // use this to override the factory's default NORMAL `returnMode` property

// Configure a task factory on the context object
taskUtils.configureTaskFactory(context, settings, options);

assert(context.taskFactory instanceof taskUtils.TaskFactory);
```

* To use the task utilities to get & set tasks on a tasks by name "map" object
```js
const taskUtils = require('task-utils');

const tasksByName = {}; // or any object to which you are attaching tasks

// To set a task into a tasks-by-name map object
taskUtils.setTask(tasksByName, 'TaskA', taskA);

// To get a task from a tasks-by-name map object
const tA = taskUtils.getTask(tasksByName, 'TaskA');

// To get a sub-task from a tasks-by-name map object
const subTaskA3 = taskUtils.getSubTask(tasksByName, 'TaskA', 'SubTaskA3');

// To get a sub-sub-task from a tasks-by-name map object
const subSubTaskA1a = taskUtils.getSubTask(tasksByName, 'TaskA', ['SubTaskA1', 'SubSubTaskA1a']);

// To get all (top-level) tasks from a tasks-by-name map object
const tasks = taskUtils.getTasks(tasksByName);

// To get all tasks and all of their sub-tasks recursively from a tasks-by-name map object
const tasksAndSubTasks = taskUtils.getTasksAndSubTasks(tasksByName);

assert(tA && subTaskA3 && subSubTaskA1a && tasks && tasksAndSubTasks);
```

## Unit tests
This module's unit tests were developed with and must be run with [tape](https://www.npmjs.com/package/tape). The unit tests have been tested on [Node.js v6.10.3](https://nodejs.org/en/blog/release/v6.10.3).  

Install tape globally if you want to run multiple tests at once:
```bash
$ npm install tape -g
```

Run all unit tests with:
```bash
$ npm test
```
or with tape:
```bash
$ tape test/*.js
```

See the [package source](https://github.com/byron-dupreez/task-utils) for more details.

## Migrating from version 5.x+ to 6.x+
- Depending on your usage, you probably need to EITHER `require` & use the new `task-factory` module:
  ```js
  const TaskFactory = require('task-utils/task-factory');
  // ... 
  const settings = {createTaskFactory: undefined, logger: console, describeItem: undefined}; // or, better yet, use a logger created using `logging-utils` module
  const options = {}; // which defaults to {returnMode: ReturnMode.NORMAL}
  // or: const options = {returnMode: ReturnMode.SUCCESS_OR_FAILURE}; // to change default `execute` behaviour to only return a Success or Failure outcome
  // or: const options = {returnMode: ReturnMode.PROMISE}; // to change default `execute` behaviour to only return a resolved or rejected Promise
  const taskFactory = new TaskFactory(settings, options);

  assert(taskFactory);
  ```
  ... OR, better yet, configure a task factory on a context object:
  ```js
  const taskUtils = require('task-utils');

  const context = {}; // or your own context object (preferably configured as a logger too using logging-utils)
  const settings = {createTaskFactory: undefined, logger: context, describeItem: undefined}; // use this to define your own custom `createTaskFactory` function to be used
  const options = undefined; // use this to set the factory's default `returnMode` property

  // Configure a task factory on the context object
  taskUtils.configureTaskFactory(context, settings, options);

  assert(context.taskFactory instanceof taskUtils.TaskFactory);
  ```
  
## Migrating from version 4.x to 5.x
- Replace all requires of `task-defs` module with:
  ```js
  const TaskDef = require('task-utils/task-defs');
  assert(TaskDef);
  ```
- Replace all requires of `tasks` module with:
  ```js
  const Task = require('task-utils/tasks');

  assert(Task);
  ```
- Depending on your usage, you probably need to EITHER `require` & use the new `task-factory` module:
  ```js
  const TaskFactory = require('task-utils/task-factory');
  // ... 
  const logger = console; // or, better yet, use a logger created using `logging-utils` module
  const factoryOpts = {}; // which defaults to {returnMode: ReturnMode.NORMAL}
  // or: const factoryOpts = {returnMode: ReturnMode.SUCCESS_OR_FAILURE}; // to change default `execute` behaviour to only return a Success or Failure outcome
  // or: const factoryOpts = {returnMode: ReturnMode.PROMISE}; // to change default `execute` behaviour to only return a resolved or rejected Promise
  const taskFactory = new TaskFactory(logger, factoryOpts);

  assert(taskFactory);
  ```
  ... OR, better yet, configure a task factory on a context object:
  ```js
  const taskUtils = require('task-utils');

  const context = {}; // or your own context object (preferably configured as a logger too using logging-utils)
  const settings = undefined; // use this to define your own custom `createTaskFactory` function to be used
  const factoryOpts = undefined; // use this to set the factory's default `returnMode` property

  // Configure a task factory on the context object
  taskUtils.configureTaskFactory(context, settings, logger, factoryOpts);

  assert(context.taskFactory instanceof taskUtils.TaskFactory);
  ```
- Replace any `Task.createTask` calls with `taskFactory.createTask` calls  
- Replace any `Task.createMasterTask` calls with `taskFactory.createMasterTask` calls  
- Fix any `new Task` calls by additionally passing a `factory` argument (and optional `opts` argument) or, better yet,
  change them to `taskFactory.createTask` calls 

## Changes
See [CHANGES.md](CHANGES.md)