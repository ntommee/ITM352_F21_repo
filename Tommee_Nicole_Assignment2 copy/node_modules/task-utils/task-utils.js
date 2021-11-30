'use strict';

const TaskDef = require('./task-defs');
const TaskFactory = require('./task-factory');
const Task = require('./tasks');
const isTaskLike = Task.isTaskLike;
const core = require('./core');
const ReturnMode = core.ReturnMode;
const states = require('./task-states');

const isInstanceOf = require('core-functions/objects').isInstanceOf;

const errors = require('core-functions/errors');

const copying = require('core-functions/copying');
const copy = copying.copy;
const merging = require('core-functions/merging');
const merge = merging.merge;

const Strings = require('core-functions/strings');
const stringify = Strings.stringify;

const tries = require('core-functions/tries');
const Try = tries.Try;
const Failure = tries.Failure;

/**
 * Utilities for accessing and managing tasks and sub-tasks stored in a "tasks-by-name" map object and for constructing
 * and configuring a task factory on a context.
 * @module task-utils/task-utils
 * @author Byron du Preez
 */
exports._$_ = '_$_'; //IDE workaround

// Functions to get tasks from and set tasks into tasks by name maps
exports.getTask = getTask;
exports.getSubTask = getSubTask;
exports.getTasks = getTasks;
exports.getTasksAndSubTasks = getTasksAndSubTasks;
exports.setTask = setTask;

// Function to check if any of a tasks by name map's tasks is not fully finalised
exports.isAnyTaskNotFullyFinalised = isAnyTaskNotFullyFinalised;

// Function to revive tasks by replacing task-likes in a tasks by name map with new tasks updated from the old task-likes
exports.reviveTasks = reviveTasks;
/** @deprecated Synonym for reviveTasks */
exports.replaceTasksWithNewTasksUpdatedFromOld = reviveTasks;

// Task factory configuration
exports.isTaskFactoryConfigured = isTaskFactoryConfigured;
exports.configureTaskFactory = configureTaskFactory;
exports.constructTaskFactory = constructTaskFactory;
exports.getDefaultTaskFactoryOpts = getDefaultTaskFactoryOpts;

// To simplify usage and reduce the number of explicit imports required

// 1. Re-export TimeoutError for convenience
exports.TimeoutError = errors.TimeoutError;

// 2. Re-export enums & errors for convenience
exports.StateType = core.StateType;
exports.ReturnMode = core.ReturnMode;
exports.FrozenError = core.FrozenError;
exports.FinalisedError = core.FinalisedError;

// 3. Re-export TaskState class and all of its subclasses from task-states.js module

// TaskState constructors
exports.TaskState = states.TaskState;

// TaskState direct subclasses
exports.Unstarted = states.Unstarted; // rather use instances.Unstarted singleton
exports.Started = states.Started; // rather use instances.Started singleton
exports.CompletedState = states.CompletedState;
exports.TimedOutState = states.TimedOutState;
exports.FailedState = states.FailedState;
exports.RejectedState = states.RejectedState;

// CompletedState subclasses
exports.Completed = states.Completed; // rather use instances.Completed singleton
exports.Succeeded = states.Succeeded; // rather use instances.Succeeded singleton

// TimedOutState subclasses
exports.TimedOut = states.TimedOut;

// FailedState subclasses
exports.Failed = states.Failed;

// RejectedState subclasses
exports.Rejected = states.Rejected;
exports.Discarded = states.Discarded;
exports.Abandoned = states.Abandoned;

// 3. Re-export TaskDef class from task-defs.js module
exports.TaskDef = TaskDef;

// 4. Re-export TaskFactory class from task-factory.js module
exports.TaskFactory = TaskFactory;

// 5. Re-export Task class from tasks.js module
exports.Task = Task;

/**
 * Gets the named task from the given tasksByName "map" object (or Map); otherwise returns undefined.
 * @param {Object|Map} tasksByName - the tasksByName "map" object (or Map) from which to get the named task
 * @param {string} taskName - the name of the task to get
 * @return {Task|TaskLike|undefined|*} the task or task-like object (ideally) or any value found; otherwise undefined
 */
function getTask(tasksByName, taskName) {
  return tasksByName instanceof Map ? tasksByName.get(taskName) : tasksByName ? tasksByName[taskName] : undefined;
}

/**
 * Gets the named sub-task of the named task from the given tasksByName "map" object (or Map); otherwise returns
 * undefined.
 *
 * If subTaskName contains an array of names, then these names are used to recurse down through the named task's
 * hierarchy of sub-tasks to locate the sub-task. For example, given taskName 'Task 1' and subTaskName(s) of
 * ['Sub-task 1.3', 'Sub-task 1.3.2', 'Sub-task 1.3.2.4'] this would effectively execute:
 * `getTask(source, 'Task 1').getSubTask('Sub-task 1.3').getSubTask('Sub-task 1.3.2').getSubTask('Sub-task 1.3.2.4');`
 *
 * @param {Object|Map} tasksByName - the tasksByName "map" object (or Map) from which to get the named task
 * @param {string} taskName - the name of the task property from which to get the value
 * @param {string|string[]} subTaskName - the name (or names) of the sub-task on the named task
 * @return {Task|TaskLike|undefined} the sub-task or sub-task-like object; otherwise undefined (if none)
 */
function getSubTask(tasksByName, taskName, subTaskName) {
  let subTask = undefined;
  let task = tasksByName instanceof Map ? tasksByName.get(taskName) : tasksByName ? tasksByName[taskName] : undefined;
  const subTaskNames = Array.isArray(subTaskName) ? subTaskName : [subTaskName];
  for (let i = 0; i < subTaskNames.length; ++i) {
    const name = subTaskNames[i];
    if (isInstanceOf(task, Task)) {
      subTask = task.getSubTask(name);
    } else if (task && task.subTasks) {
      subTask = task.subTasks.find(st => st.name === name);
    } else {
      return undefined;
    }
    task = subTask;
  }
  return subTask;
}

/**
 * Finds and returns all of the tasks (i.e. Task or Task-like objects) registered by their names as properties (or keys)
 * on the given tasksByName object (or Map).
 * @param {Object|Map} tasksByName - the tasksByName object (or Map)
 * @returns {Task[]|TaskLike[]} the list of Tasks and/or Task-like objects found
 */
function getTasks(tasksByName) {
  const tasks = [];
  if (tasksByName instanceof Map) {
    // tasksByName is a Map
    tasksByName.forEach((task, taskName) => {
      if (isTaskLike(task, taskName)) {
        tasks.push(task);
      }
    });
  } else if (tasksByName && typeof tasksByName === 'object') {
    // tasksByName is a "dictionary"/"map" object
    const taskNames = Object.getOwnPropertyNames(tasksByName);
    for (let i = 0; i < taskNames.length; ++i) {
      const taskName = taskNames[i];
      const task = tasksByName[taskName];
      if (Task.isTaskLike(task, taskName)) {
        tasks.push(task);
      }
    }
  }
  return tasks;
}

/**
 * Finds and returns all of the tasks (i.e. Task or Task-like objects) registered by their names as properties (or keys)
 * on the given tasksByName object (or Map) and also all of their sub-tasks recursively.
 * @param {Object|Map} tasksByName - the tasksByName object (or Map)
 * @returns {Task[]|TaskLike[]} the list of Tasks and/or Task-like objects found and all of their sub-tasks recursively
 */
function getTasksAndSubTasks(tasksByName) {
  // First get all of the tasks on the given tasksByName map
  const tasks = getTasks(tasksByName);

  const allTasksAndSubTasks = [];

  // Collect all tasks and all of their subtasks recursively
  tasks.forEach(task => Task.forEachTaskLike(task, t => allTasksAndSubTasks.push(t)));

  return allTasksAndSubTasks;
}

/**
 * Puts the given task into the given tasksByName "map" object (or Map) using the given taskName as the key.
 * @param {Object|Map} tasksByName - the tasksByName "map" object (or Map) on which to set the task
 * @param {string} taskName - the name of the task to use as the key into the map
 * @param {Task} task - the task to set
 * @return {Object|Map} the given tasksByName "map object (or Map)
 */
function setTask(tasksByName, taskName, task) {
  tasksByName instanceof Map ? tasksByName.set(taskName, task) : tasksByName[taskName] = task;
  return tasksByName;
}

/**
 * Returns true if any of the given tasks by name map's tasks is not fully finalised yet; otherwise returns false.
 * @param {Object|Map} tasksByName - the tasksByName "map" object (or Map) on which to check its tasks
 * @return {boolean} true if any task is not fully finalised yet; otherwise false
 */
function isAnyTaskNotFullyFinalised(tasksByName) {
  if (tasksByName) {
    const tasks = getTasks(tasksByName);
    return tasks.some(task => !task.isFullyFinalised());
  }
  return false;
}

/**
 * Revives all of the tasks in the given tasksByName "map" object by replacing all of its old task-likes with new tasks
 * created from the given list of active task definitions and updates these new tasks with the state of the old tasks or
 * task-like objects, which are the prior versions of the tasks from a previous attempt (if any). Any and all old tasks
 * that do NOT appear in the list of new active tasks are also recreated and added to the given tasksByName as unusable
 * tasks. Finally, returns both the newly created and updated, active tasks and any inactive unusable tasks that were
 * all added to the given tasksByName "map".
 *
 * @param {Object|Map} tasksByName - the tasksByName "map" object (or Map) on which to replace its old tasks or task-likes
 * @param {TaskDef[]} activeTaskDefs - a list of active task definitions from which to create the new tasks
 * @param {TaskFactory} taskFactory - the task factory to use to create the replacement tasks
 * @param {ReviveTasksOpts|undefined} [opts] - optional options to use to influence which tasks get created and how they get created during task revival/re-incarnation
 * @param {boolean|undefined} [opts.onlyRecreateExisting] - whether to only recreate existing old tasks or to create new tasks for every active task definition (regardless of whether the task existed before or not)
 * @returns {[Task[], Task[]]} both the updated, newly created active tasks and any inactive unusable tasks
 */
function reviveTasks(tasksByName, activeTaskDefs, taskFactory, opts) {
  // Fetch any and all of the existing previous version tasks from the given tasksByName map
  const priorTasks = getTasks(tasksByName);

  // Create new tasks from the given active task definitions and update them with the info from the previous tasks
  const activeAndUnusableTasks = taskFactory.reincarnateTasks(activeTaskDefs, priorTasks, opts);
  const activeTasks = activeAndUnusableTasks[0];
  const unusableTasks = activeAndUnusableTasks[1];
  const allTasks = activeTasks.concat(unusableTasks);

  // Replace all of the existing tasks on the given tasksByName map with the new and abandoned tasks
  allTasks.forEach(task => setTask(tasksByName, task.name, task));

  return activeAndUnusableTasks;
}

/**
 * Returns true if a valid TaskFactory instance is already configured on the given context object; false otherwise.
 * @param {TaskFactoryAware|Object} context - the context to check
 * @returns {boolean} true if the context is configured with a valid TaskFactory; false otherwise
 */
function isTaskFactoryConfigured(context) {
  return isInstanceOf(context.taskFactory, TaskFactory);
}

/**
 * Constructs a new task factory using the given optional settings and with the given logger and optional factory opts
 * and then configures the given context object with the new task factory, but ONLY if the given context does NOT
 * already have a valid task factory.
 * @param {TaskFactoryAware|Object} context - the context onto which to configure a task factory
 * @param {TaskFactoryExtendedSettings|undefined} [settings] - optional extended settings to use to construct & configure the task factory
 * @param {TaskFactoryOptions|undefined} [options] - optional factory opts with which to construct the task factory
 * @returns {TaskFactoryAware} the given context configured with a task factory
 */
function configureTaskFactory(context, settings, options) {
  // Check if a task factory is already configured on the context
  if (isTaskFactoryConfigured(context)) {
    return context;
  }
  // Resolve the `createTaskFactory` function to use (if configured)
  const createTaskFactory = settings ? settings.createTaskFactory : undefined;

  context.taskFactory = constructTaskFactory(createTaskFactory, settings, options);

  return context;
}

/** Loads the local default options & merges them with the static default options */
function getDefaultTaskFactoryOpts() {
  const defaultOptions = copy(require('./default-factory-opts.json'), {deep: true});
  // Remove any invalid defaultOptions.returnMode
  if (!ReturnMode.isValid(defaultOptions.returnMode)) {
    delete defaultOptions.returnMode;
  }
  return merge({returnMode: ReturnMode.NORMAL}, defaultOptions);
}

/**
 * Constructs a new task factory with the given logger and factory opts using either the given `createTaskFactory`
 * function (if defined) or the default TaskFactory constructor (if not).
 * @param {CreateTaskFactory|undefined} [createTaskFactory] - an optional function to use to create a new task factory
 * @param {TaskFactorySettings|undefined} [settings] - optional settings to use to construct the task factory
 * @param {TaskFactoryOptions|undefined} [options] - optional options to use to construct the task factory
 * @returns {TaskFactory} a new TaskFactory instance
 * @throws {Error} if the given createTaskFactory function is defined, but is not a function or does not create a valid
 * TaskFactory or if it throws an error
 */
function constructTaskFactory(createTaskFactory, settings, options) {
  // Resolve the task factory settings to be used
  const settingsToUse = settings && typeof settings === 'object' ? copy(settings, {deep: false}) :
    {logger: console};

  // Resolve & default logger if missing
  if (!settingsToUse.logger) settingsToUse.logger = console; // default logger to console if undefined
  const logger = settingsToUse.logger;

  // Resolve the task factory options to be used
  const optionsToUse = options && typeof options === 'object' ? copy(options, {deep: true}) : {};
  merge(getDefaultTaskFactoryOpts(), optionsToUse);

  if (createTaskFactory) {
    // Ensure that `createTaskFactory` is a function
    if (typeof createTaskFactory !== "function") {
      const errMsg = `Failed to construct a task factory, since createTaskFactory (${stringify(createTaskFactory)}) is NOT a function `;
      logger.error(errMsg);
      throw new Error(errMsg);
    }
    // Attempt to create a task factory using the given `createTaskFactory` function
    const outcome = Try.try(() => createTaskFactory(settingsToUse, optionsToUse)).map(
      taskFactory => {
        // Ensure that the `createTaskFactory` function actually returned a valid TaskFactory instance
        if (!isInstanceOf(taskFactory, TaskFactory)) {
          const errMsg = `Failed to construct a task factory, since ${stringify(createTaskFactory)} did NOT create an instance of TaskFactory - unexpected result: ${stringify(taskFactory)}`;
          logger.error(errMsg);
          return new Failure(new Error(errMsg)); // throw new Error(errMsg);
        }
        logger.log('DEBUG', `Constructed a ${taskFactory.constructor.name} task factory using ${stringify(createTaskFactory)} with options ${stringify(optionsToUse)}`);
        return taskFactory;
      },
      err => {
        const errMsg = `Failed to construct a task factory, since ${stringify(createTaskFactory)} failed`;
        logger.error(errMsg, err);
        return new Failure(err); // throw err;
      }
    );
    return outcome.get();
  }
  logger.log('DEBUG', `Constructed a TaskFactory task factory using the default TaskFactory constructor with options ${stringify(optionsToUse)}`);
  return new TaskFactory(settingsToUse, optionsToUse);
}
