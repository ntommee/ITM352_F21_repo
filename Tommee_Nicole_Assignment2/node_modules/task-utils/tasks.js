'use strict';

/**
 * A Task class representing an executable task or an executable or non-executable sub-task that can be used to track
 * the state of a task, function call or operation.
 * @module task-utils/tasks
 * @author Byron du Preez
 */

const states = require('./task-states');
const TaskState = states.TaskState;

const TaskDef = require('./task-defs');

const isInstanceOf = require('core-functions/objects').isInstanceOf;

const Strings = require('core-functions/strings');
const stringify = Strings.stringify;
const isNotBlank = Strings.isNotBlank;

const Arrays = require('core-functions/arrays');
const isDistinct = Arrays.isDistinct;

const copying = require('core-functions/copying');
const copy = copying.copy;

const core = require('./core');
const ReturnMode = core.ReturnMode;

// const strict = {strict: true};

//======================================================================================================================
// Task "class"
//======================================================================================================================

/**
 * A task or operation, which can be either an executable, self-managed task/sub-task or a non-executable, externally
 * managed sub-task based on the task definition from which it is constructed.
 *
 * An executable sub-task is a task that must be explicitly executed by calling its `execute` method from within its
 * parent task's `execute` method and that must partially or entirely manage its own state within its `execute` method.
 *
 * A non-executable, externally managed sub-task is a task that must be manually executed from and must have its state
 * managed entirely by its parent task's `execute` method and that is ONLY used to enable tracking of its state.
 */
class Task {

  /**
   * Constructs a task, which can be either an executable, self-managed task/sub-task or a non-executable, externally
   * managed sub-task based on the given task definition and optional parent task. If parent is specified then this new
   * task is assumed to be a sub-task of the given parent task and the given taskDef should be a sub-task definition.
   *
   * @param {TaskDef} taskDef - the definition of this task
   * @param {Task|null|undefined} [parent] - an optional parent task
   * @param {TaskFactory} factory - the task factory to use to generate an `execute` method for this task & to create new sub-tasks for this task
   * @param {TaskOpts|undefined} [opts] - optional options to use to alter the behaviour of this Task
   * @throws {Error} an error if the requested task is invalid
   */
  constructor(taskDef, parent, factory, opts) {
    // Validate the given task definition
    // -----------------------------------------------------------------------------------------------------------------
    // Ensure the given task definition is valid
    if (!isInstanceOf(taskDef, TaskDef)) {
      throw new Error(`Cannot create a task without a valid task definition (${stringify(taskDef)})`);
    }

    const taskName = taskDef.name;

    // Validate the given parent
    // -----------------------------------------------------------------------------------------------------------------
    if (parent) {
      // Creating a sub-task, so:
      // Ensure that the parent task is a valid task
      if (!isInstanceOf(parent, Task)) {
        throw new Error(`Cannot create a sub-task with an invalid super-task (${stringify(parent)})`);
      }
      // Ensure that execute (if defined) is actually executable (i.e. a valid function)
      if (taskDef.execute !== undefined && typeof taskDef.execute !== 'function') {
        throw new Error(`Cannot create an executable sub-task definition (${taskName}) with an invalid execute function`);
      }
      // Ensure the parent's sub-task names will still be distinct if we include this new sub-task's name
      if (!Task.areSubTaskNamesDistinct(parent, taskName)) {
        throw new Error(`Cannot add a sub-task (${taskName}) with a duplicate name to super-task (${parent.name}) with existing sub-tasks ${Strings.stringify(parent.subTasks ? parent.subTasks.map(t => t.name) : undefined)}`);
      }
    } else {
      // Creating an executable, top-level task, so:
      // Ensure that a top-level task (without a parent) does have an execute function, since a non-executable,
      // externally managed top-level task would be useless
      if (taskDef.managed) {
        throw new Error(`Cannot create a top-level task (${taskName}) from a definition that defines managed, non-executable tasks`);
      }
      // Ensure that task definition's execute function (if defined) is actually executable (i.e. a valid function)
      if (typeof taskDef.execute !== 'function') {
        throw new Error(`Cannot create a top-level task (${taskName}) from a definition with an invalid execute function`);
      }
    }

    // Ensure the given task factory is valid
    if (!factory || typeof factory.generateExecute !== "function" || typeof factory.createTask !== "function") {
      throw new Error(`Cannot create a task without a valid task factory (${stringify(factory)})`);
    }

    // Resolve the opts to use - preferring the given opts (if any) over the parent's _opts (if any)
    opts = opts || (parent && parent._opts);

    // Finalise the new task's parent and execute function
    const taskParent = parent ? parent : undefined;
    const managed = taskDef.managed;
    const self = this;

    // Finally create each property (other than subTasks & subTasksByName) as read-only (writable: false and
    // configurable: false are defaults)
    // -----------------------------------------------------------------------------------------------------------------
    Object.defineProperty(this, 'name', {value: taskName, enumerable: true});
    Object.defineProperty(this, 'definition', {value: taskDef, enumerable: false});
    Object.defineProperty(this, 'managed', {value: managed, enumerable: true});
    Object.defineProperty(this, 'factory', {value: factory, enumerable: false});

    // Set the returnMode property to opts.returnMode if it is defined; otherwise to undefined
    let returnMode = opts && opts.returnMode ? opts.returnMode : undefined;
    if (returnMode && !ReturnMode.isValid(returnMode)) {
      factory.logger.warn(`Ignoring invalid opts.returnMode (${returnMode}) - defaulting Task (${taskName}) returnMode to undefined`);
      returnMode = undefined;
    }
    Object.defineProperty(this, 'returnMode', {value: returnMode, enumerable: false});

    // Create a new task execute function from the task and its execute function using the configured factory function
    // NB: `execute` MUST be set after setting `returnMode`!
    const executeAndUpdate = !managed && taskDef.execute ? factory.generateExecute(self, taskDef.execute) : undefined;
    Object.defineProperty(this, 'execute', {value: executeAndUpdate, enumerable: false});

    // Keep a reference to the opts used, but ONLY to pass on to any new sub-tasks added later via `getOrCreateSubTask` if needed
    Object.defineProperty(this, '_opts', {value: opts, enumerable: false});

    // Define a subTasks property for this task's subTasks (if any)
    // -----------------------------------------------------------------------------------------------------------------
    // NB Even though not ideal, we MUST define subTasks and subTasksByName properties before creating and adding any
    // subTasks, since the construction of a sub-task needs the parent's subTasks property to already exist
    const subTasks = [];
    Object.defineProperty(this, '_subTasks', {value: subTasks, enumerable: true});

    // Define a subTasksByName property, which will be a map of each of the task's subTasks keyed by their names for
    // convenient look up by name
    // -----------------------------------------------------------------------------------------------------------------
    const subTasksByName = new Map();
    Object.defineProperty(this, '_subTasksByName', {value: subTasksByName, enumerable: false});

    // Create each of this task's subTasks (if any), which will also result in them being added to subTasks and mapped
    // into subTasksByName
    // -----------------------------------------------------------------------------------------------------------------
    taskDef.subTaskDefs.forEach(subTaskDef => new Task(subTaskDef, this, factory, opts));

    // Final validation of task hierarchy
    // -----------------------------------------------------------------------------------------------------------------
    if (taskParent) {
      // Ensure that the proposed combined hierarchy to be formed from this new task and its parent will still be valid
      // and will ONLY contain distinct tasks
      // NB: Must check this after adding subTasks, but before setting parent!
      Task.ensureAllTasksDistinct(taskParent, this);
    }

    // Link this new task to its parent (if any)
    // -----------------------------------------------------------------------------------------------------------------
    Object.defineProperty(this, 'parent', {value: taskParent, enumerable: false, writable: false, configurable: false});
    if (taskParent) {
      // Ensure that the parent task contains this new task as a subTask
      taskParent._subTasks.push(this);
      taskParent._subTasksByName.set(taskName, this);
    }

    // Set the task's initial state, attempts and result
    this._state = TaskState.instances.Unstarted;
    this._attempts = 0;
    this._initialAttempts = undefined;
    this._totalAttempts = 0;
    this._began = undefined;
    this._took = undefined;
    this._ended = undefined;

    // The task's optional result must NOT be enumerable, since the result may end up being an object that references
    // this task, which would create a circular dependency
    Object.defineProperty(this, '_result', {value: undefined, writable: true, enumerable: false});

    // The task's optional error must NOT be enumerable, since an error is not JSON serializable
    Object.defineProperty(this, '_error', {value: undefined, writable: true, enumerable: false});

    Object.defineProperty(this, '_slaveTasks', {value: [], writable: true, enumerable: false});

    Object.defineProperty(this, '_frozen', {value: false, writable: true, enumerable: false});

    // The outcome & donePromise properties will be set by the `executed` method immediately after the `execute` function
    // has been executed (this will be invoked in the wrapper `execute` function generated by the given factory)
    Object.defineProperty(this, '_outcome', {value: undefined, writable: true, enumerable: false});
    Object.defineProperty(this, '_donePromise', {value: undefined, writable: true, enumerable: false});
  }

  /**
   * Returns true if this task is an executable task; otherwise false if it's a non-executable, externally managed task
   * @return {boolean} true if executable; false otherwise
   */
  get executable() {
    return !this.managed;
  }

  /**
   * The sub-tasks of this task (if any)
   * @type Task[]
   */
  get subTasks() {
    return this._subTasks;
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * The slave tasks of this task, which if present classify this task as a "master" task.
   * @type Task[]
   */
  get slaveTasks() {
    return this._slaveTasks;
  }

  /**
   * The state of this task.
   * @type AnyTaskState
   */
  get state() {
    return this._state;
  }

  /**
   * The type of the state of this task.
   * @type StateType
   */
  get stateType() {
    return this._state ? this._state.type : undefined;
  }

  /**
   * The number of attempts at this task, which must be incremented every time the task is executed and which can be
   * decremented if any failure indicates a transient error such as throttled or timed-out.
   * @type number
   */
  get attempts() {
    return this._attempts;
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * The total number of attempts at this task, which is never decremented by {@linkcode decrementAttempts} and is purely
   * informational. Synonym for `total`.
   * @type number
   */
  get totalAttempts() {
    return this._totalAttempts;
  }

  /**
   * Synonym for `totalAttempts`.
   * @type number
   */
  get total() {
    return this._totalAttempts;
  }

  /**
   * Notifies this task that its last execution began at the given date-time (or now if undefined).
   * @param {Date|string|undefined} [startTime] - the optional date-time at which this task's last execution began (defaults to now if undefined)
   * @param {boolean|undefined} [recursively] - whether to also apply the began at time to this task's sub-tasks recursively or not (default false, i.e. don't recurse)
   * @param {boolean|undefined} [skipSlaves] - whether to skip applying the began at time to this task's slave-tasks or not (default false, i.e. don't skip slaves)
   */
  beganAt(startTime, recursively, skipSlaves) {
    if (!this._frozen) {
      const began = startTime instanceof Date ? startTime : startTime && typeof startTime === 'string' ?
        new Date(Date.parse(startTime)) : new Date();

      if (this.incomplete) {
        this._began = began.toISOString();

        // Reset ended time if necessary
        if (this._ended && this._ended < this._began) this._ended = undefined;

        // Calculate or reset took ms if necessary
        this._took = calculateTook(this._began, this._ended);
      }

      // If recursively, then also apply the began at time to each of this task's sub-tasks
      if (recursively) {
        this._subTasks.forEach(subTask => subTask.beganAt(began, recursively, skipSlaves));
      }

      // If not skipping slaves and this is a master task, then ripple the began at time to each of its slave tasks
      if (!skipSlaves && this.isMasterTask()) {
        this._slaveTasks.forEach(slaveTask => slaveTask.beganAt(began, recursively, skipSlaves));
      }
    }
  }

  /**
   * Notifies this task that its last execution ended at the given date-time (or now if undefined).
   * @param {Date|string|undefined} [endTime] - the optional date-time at which this task's last execution ended (defaults to now if undefined)
   * @param {boolean|undefined} [recursively] - whether to also apply the ended at time to this task's sub-tasks recursively or not (default false, i.e. don't recurse)
   * @param {boolean|undefined} [skipSlaves] - whether to skip applying the ended at time to this task's slave-tasks or not (default false, i.e. don't skip slaves)
   */
  endedAt(endTime, recursively, skipSlaves) {
    if (!this._frozen) {
      const ended = endTime instanceof Date ? endTime :
        endTime && typeof endTime === 'string' ? new Date(Date.parse(endTime)) : new Date();

      if (!this._ended) {
        this._ended = ended.toISOString();

        // Calculate or reset took ms if necessary
        this._took = calculateTook(this._began, this._ended);
      }

      // If recursively, then also apply the ended at time to each of this task's sub-tasks
      if (recursively) {
        this._subTasks.forEach(subTask => subTask.endedAt(ended, recursively, skipSlaves));
      }

      // If not skipping slaves and this is a master task, then ripple the ended at time to each of its slave tasks
      if (!skipSlaves && this.isMasterTask()) {
        this._slaveTasks.forEach(slaveTask => slaveTask.endedAt(ended, recursively, skipSlaves));
      }
    }
  }

  /**
   * The ISO date-time at which this task's last execution began (or undefined if not executed yet).
   * @type (string|undefined)
   */
  get began() {
    return this._began;
  }

  /**
   * The number of milliseconds that this task's last execution took (or undefined if not executed yet).
   * @type (number|undefined)
   */
  get took() {
    return this._took;
  }

  /**
   * The ISO date-time at which this task's last execution ended (or undefined if not executed yet).
   * @type (string|undefined)
   */
  get ended() {
    // If no ended time, then calculate one from began time & took ms (if available)
    return this._ended ? this._ended : calculateEnded(this._began, this._took);
  }

  /**
   * The result with which this task was completed (if any).
   * @type *|undefined
   */
  get result() {
    return this._result;
  }

  /**
   * The error with which this task was failed, timed out or rejected (if any).
   * @type Error|undefined
   */
  get error() {
    return this._error;
  }

  /** The success or failure outcome of the execution of this task (undefined if not executed yet).
   * @type Success|Failure|undefined
   * @see {TaskFactory#generateExecute~executeAndUpdateTask}
   * @see {TaskFactory#updateTask}
   */
  get outcome() {
    return this._outcome;
  }

  /**
   * A promise that will only resolve when every promise of this Task's execution outcome resolves, at which point the
   * execution is deemed to be completely "done". The default TaskFactory considers any outcome that is either a promise
   * or an array of promises to be an asynchronous outcome and hence sets the "done" promise to only complete when either
   * the single promise outcome resolves or when EVERY promise in the outcome's array of promises resolves.
   * @type Promise.<(Success|Failure)[]>|undefined
   * @see {TaskFactory#generateExecute~executeAndUpdateTask}
   * @see {TaskFactory#updateTask}
   */
  get donePromise() {
    return this._donePromise;
  }

  //noinspection JSUnusedGlobalSymbols
  /**
   * Customized toJSON method, which is used by {@linkcode JSON.stringify}.
   */
  toJSON() {
    const json = {name: this.name};
    if (this.managed) {
      json.managed = this.managed;
    }
    json.state = this._state;
    json.attempts = this._attempts;
    json.total = this._totalAttempts;

    if (this._began) {
      json.began = this._began;
    }
    const tookIsValid = typeof this._took === 'number';
    if (this._ended && (!this._began || !tookIsValid)) { // ONLY add ended if don't have began or a valid took ms
      json.ended = this._ended;
    }
    if (tookIsValid) {
      json.took = this._took;
    }

    if (this._subTasks.length > 0) json.subTasks = this._subTasks;

    return json;
  }

  /**
   * Returns true if this task is a super-task, i.e. if it has any sub-tasks; false otherwise.
   * @returns {boolean} true if super-task; false otherwise
   */
  isSuperTask() {
    return this._subTasks.length > 0;
  }

  /**
   * Returns true if this task is a root or top-level task, i.e. a task that is not a sub-task itself and that is at the
   * root/top of its task hierarchy; false otherwise
   * @returns {boolean} true if root task; false otherwise
   */
  isRootTask() {
    return !this.parent;
  }

  /**
   * Returns true if this task is a sub-task, i.e. if it it belongs to a super-task; false otherwise.
   * @returns {boolean} true if sub-task; false otherwise
   */
  isSubTask() {
    return !!this.parent;
  }

  /**
   * Returns the sub-task with the given name if it exists on this task; otherwise returns undefined.
   * @param {string} subTaskName - the name of the sub-task to retrieve
   * @returns {Task|undefined} the named sub-task if it exists; otherwise undefined
   */
  getSubTask(subTaskName) {
    return this._subTasksByName.get(subTaskName);
  }

  /**
   * Returns the existing usable sub-task with the given name (if it exists and its NOT unusable); otherwise replaces
   * the existing unusable sub-task with the given name (if it exists and its unusable) with a new usable version of
   * itself that is created with the given `execute` function and a copy of the old sub-task's state; otherwise creates
   * and adds a new sub-task with the given name and `execute` function to this task and returns it.
   * NB: By default, skips adding any new sub-task definition to its parent (unless `taskDefSettings.skipAddToParent` is
   * explicitly set to false) to avoid changing the original task definition hierarchy when adding a new "dynamic" sub-task.
   * @param {string} subTaskName - the name of the sub-task to retrieve or add
   * @param {Function|undefined} [execute] - the optional function to be executed when the sub-task is executed
   * @param {TaskDefSettings|undefined} [taskDefSettings] - optional settings to use to configure the task definition for the new sub-task
   * @param {boolean|undefined} [taskDefSettings.skipAddToParent] - defaults to true (i.e. skips adding the new sub-task definition to its parent) if not explicitly defined
   * @param {TaskOpts|undefined} [opts] - optional options to use to alter the behaviour of the newly created sub-task (if applicable)
   * @returns {Task} the named sub-task if it exists; otherwise a new sub-task
   */
  getOrCreateSubTask(subTaskName, execute, taskDefSettings, opts) {
    const subTask = this._subTasksByName.get(subTaskName);
    if (subTask) {
      // Return an existing, usable sub-task as is
      if (!subTask.unusable) {
        return subTask;
      }

      // Recreate an existing, unusable sub-task as a new sub-task
      this.detachSubTask(subTaskName);

      // const newSubTaskDef = new TaskDef(subTaskName, execute, this.definition, {skipAddToParent: true});
      // const newSubTask = new Task(newSubTaskDef, this);
      const newSubTask = this.createSubTask(subTaskName, execute, taskDefSettings, opts);

      newSubTask.updateFromPriorVersion(subTask);

      return newSubTask;
    }

    // Create a brand new sub-task
    return this.createSubTask(subTaskName, execute, taskDefSettings, opts);
  }

  /**
   * Shortcut that defines a new "dynamic" sub-task definition with the given name and `execute` function and then
   * creates a new "dynamic" sub-task (for this task) using this new definition, this task's factory and the given opts.
   * NB: By default, skips adding the new sub-task definition to its parent (unless `taskDefSettings.skipAddToParent` is
   * explicitly set to false) to avoid changing the original task definition hierarchy when adding the new sub-task.
   * @param {string} subTaskName - the name of the sub-task to retrieve or add
   * @param {Function|undefined} [execute] - the optional function to be executed when the sub-task is executed
   * @param {TaskDefSettings|undefined} [taskDefSettings] - optional settings to use to configure the task definition for the new sub-task
   * @param {boolean|undefined} [taskDefSettings.skipAddToParent] - defaults to true (i.e. skips adding the new sub-task definition to its parent) if not explicitly defined
   * @param {TaskOpts|undefined} [opts] - optional options to use to alter the behaviour of the newly created sub-task
   * @returns {Task} the newly created sub-task for this task
   * @throws {Error} an error if the given name is invalid or non-unique or the given `execute` function is invalid
   */
  createSubTask(subTaskName, execute, taskDefSettings, opts) {
    const settings = taskDefSettings ? copy(taskDefSettings) : {skipAddToParent: true}; // copy to avoid mutating given
    if (taskDefSettings && !settings.hasOwnProperty('skipAddToParent')) {
      settings.skipAddToParent = true; // default to skipping add to parent IF NOT explicitly set
    }

    const subTaskDef = this.definition.defineSubTask(subTaskName, execute, settings);

    return new Task(subTaskDef, this, this.factory, opts);
  }

  /**
   * Detaches the named sub-task from this task and returns it (if it exists).
   * @param {string} subTaskName - the name of the sub-task to detach
   * @return {Task|undefined} the detached sub-task
   */
  detachSubTask(subTaskName) {
    const detached = this._subTasksByName.get(subTaskName);
    if (detached) {
      // Detached sub-task still remembers its parent, but parent will no longer remember it
      const pos = this._subTasks.indexOf(detached);
      if (pos !== -1) this._subTasks.splice(pos, 1);
      this._subTasksByName.delete(subTaskName);
    }
    return detached
  }

  /**
   * Returns true if this task is unstarted (i.e. in an unstarted state that is not completed, not rejected and has no
   * error); false otherwise
   * @type {boolean}
   */
  get unstarted() {
    return this._state.unstarted;
  }

  /**
   * Returns true if this task has been started (i.e. in a started state that is not completed, not rejected and has no
   * error); false otherwise
   * @type {boolean}
   */
  get started() {
    return this._state.started;
  }

  /**
   * Returns true if this task is incomplete (i.e. in an incomplete state that is not completed and not rejected); false
   * otherwise
   * @type {boolean}
   */
  get incomplete() {
    return this._state.incomplete;
  }

  /**
   * Returns true if this task is successfully completed (i.e. in any of the completed states); false otherwise
   * @type {boolean}
   */
  get completed() {
    return this._state.completed;
  }

  /**
   * Returns true if this task is timed out (i.e. in any of the timeout states); false otherwise
   * @type {boolean}
   */
  get timedOut() {
    return this._state.timedOut;
  }

  /**
   * Returns true if this task is rejected (i.e. in any of the rejected states); false otherwise
   * @type {boolean}
   */
  get rejected() {
    return this._state.rejected;
  }

  /**
   * Returns true if this task has failed (i.e. in any of the failed states); false otherwise
   * @type {boolean}
   */
  get failed() {
    return this._state.failed;
  }

  /**
   * Returns true if this task is finalised (i.e. in a final state, either completed or rejected); false otherwise
   * @type {boolean}
   */
  get finalised() {
    return this._state.finalised;
  }

  /**
   * Returns true if this task and all of its subTasks recursively are finalised (i.e. in a final state, either
   * completed or rejected); false otherwise
   * @returns {boolean} true if totally finalised; false otherwise
   */
  isFullyFinalised() {
    return this.finalised && this._subTasks.every(subTask => subTask.isFullyFinalised());
  }

  /**
   * Returns true if this task and all of its subTasks recursively are either finalised (i.e. in a final state, either
   * completed or rejected) or unusable; false otherwise
   * @returns {boolean} true if totally finalised or unusable; false otherwise
   */
  isFullyFinalisedOrUnusable() {
    return (this.finalised || this.unusable) && this._subTasks.every(subTask => subTask.isFullyFinalisedOrUnusable());
  }

  /**
   * Returns true if this task is in a Rejected state; false otherwise
   * @returns {boolean} true if in a Rejected state; false otherwise
   */
  isRejected() {
    return this._state.isRejected();
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Returns true if this task is in an Abandoned state; false otherwise
   * @returns {boolean} true if in an Abandoned state; false otherwise
   */
  isAbandoned() {
    return this._state.isAbandoned();
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * Returns true if this task is in a Discarded state; false otherwise
   * @returns {boolean} true if in a Discarded state; false otherwise
   */
  isDiscarded() {
    return this._state.isDiscarded();
  }

  /**
   * Resets this task's state back to Unstarted and its result back to undefined (if it's in an incomplete state or if
   * it's a completed, root super-task with incomplete sub-tasks) and also recursively resets any and all of its
   * subTasks's states back to Unstarted and results back to undefined (if they are still incomplete).
   */
  reset() {
    if (this.incomplete || (this.completed && this.isRootTask() && this.isSuperTask() && !this.isFullyFinalised())) {
      this._state = TaskState.instances.Unstarted;
      this._initialAttempts = undefined;
      this._result = undefined;
      this._error = undefined;
      this._outcome = undefined;
      this._donePromise = undefined;
    }
    this._subTasks.forEach(subTask => subTask.reset());

    // If this is a master task then ripple the state change to each of its slave tasks
    if (this.isMasterTask()) {
      this._slaveTasks.forEach(slaveTask => slaveTask.reset());
    }
  }

  /**
   * Starts this task (but ONLY if it's still unstarted) by changing its state to started, incrementing the number of
   * attempts at this task and updates its last executed at date-time to the given executed at date-time. If recursively
   * is true, then also starts each of this task' sub-tasks recursively.
   * @param {Date|string|undefined} [startTime] - the ISO date-time at which this task was executed (defaults to current ISO date-time if undefined)
   * @param {boolean|undefined} [recursively] - whether to also apply the state change, increment and update to this
   * task's sub-tasks recursively or not
   */
  start(startTime, recursively) {
    const began = startTime instanceof Date ? startTime :
      startTime && typeof startTime === 'string' ? new Date(Date.parse(startTime)) : new Date();

    if (this.unstarted) {
      this._state = TaskState.instances.Started;
      this._initialAttempts = this._attempts; // cache the initial number of attempts to enable later reverts if needed
      this._attempts = this._attempts + 1;
      this._totalAttempts = this._totalAttempts + 1;
      this.beganAt(began, false, true);
    }

    // If recursively, then also apply the start to each of this task's sub-tasks
    if (recursively) {
      this._subTasks.forEach(subTask => subTask.start(began, recursively));
    }

    // If this is a master task then ripple the start to each of its slave tasks
    if (this.isMasterTask()) {
      this._slaveTasks.forEach(slaveTask => slaveTask.start(began, recursively));
    }
  }

  /**
   * Reverses the current number of attempts back to the initial number of attempts that was cached just before this
   * task was last started.
   * @param {boolean|undefined} [recursively] - whether to recursively apply the revert attempts to this task's sub-tasks or not
   */
  revertAttempts(recursively) {
    if (this._initialAttempts !== undefined) {
      this._attempts = this._initialAttempts;
    }

    // If recursively, then also apply the revert attempts to each of this task's sub-tasks
    if (recursively) {
      this._subTasks.forEach(subTask => subTask.revertAttempts(recursively));
    }

    // If this is a master task then ripple the revert attempts to each of its slave tasks
    if (this.isMasterTask()) {
      this._slaveTasks.forEach(slaveTask => slaveTask.revertAttempts(recursively));
    }
  }

  /**
   * Increments the number of attempts at this task, but ONLY if the task is in an incomplete (non-finalised) state!
   * If recursively is true, then also applies the increment to each of this task' sub-tasks recursively.
   * @param {boolean|undefined} [recursively] - whether to also apply the increment to sub-tasks recursively or not
   */
  incrementAttempts(recursively) {
    if (this.incomplete) {
      this._attempts = this._attempts + 1;
      this._totalAttempts = this._totalAttempts + 1;
    }
    // If recursively, then also apply the increment to each of this task's sub-tasks
    if (recursively) {
      this._subTasks.forEach(subTask => subTask.incrementAttempts(recursively));
    }

    // If this is a master task then ripple the increment attempts to each of its slave tasks
    if (this.isMasterTask()) {
      this._slaveTasks.forEach(slaveTask => slaveTask.incrementAttempts(recursively));
    }
  }

  /**
   * Decrements the number of attempts at this task, but ONLY if the task is in an incomplete (non-finalised) state!
   * MUST ONLY be used in cases where a failure indicates a transient error such as a throttled or timeout error!
   * If recursively is true, then also applies the decrement to each of this task' sub-tasks recursively.
   * @param {boolean|undefined} [recursively] - whether to also apply the decrement to sub-tasks recursively or not
   */
  decrementAttempts(recursively) {
    if (this.incomplete) {
      this._attempts = this._attempts - 1;
      // Do NOT decrement total attempts, which tracks of the total number of attempts regardless of decrements/transient errors
    }
    // If recursively, then also apply the increment to each of this task's sub-tasks
    if (recursively) {
      this._subTasks.forEach(subTask => subTask.decrementAttempts(recursively));
    }

    // If this is a master task then ripple the increment attempts to each of its slave tasks
    if (this.isMasterTask()) {
      this._slaveTasks.forEach(slaveTask => slaveTask.decrementAttempts(recursively));
    }
  }

  /**
   * Executes the given callback function on this task and then recursively on all of its sub-tasks.
   * @param {Function} callback - a callback function
   */
  forEach(callback) {
    callback(this);
    this._subTasks.forEach(t => t.forEach(callback));
  }

  /**
   * Completes this task with a Completed state and the given optional result, but ONLY if the task is still incomplete
   * and EITHER NOT timed out OR overrideTimedOut is true. If recursively is true, then also completes any and all of
   * its subTasks recursively.
   *
   * @param {*} [result] - the optional result to store on the task
   * @param {CompleteOpts|boolean|undefined} [opts] - the optional options to use to modify the behaviour of this `complete` method (if its a boolean, then treat it as a legacy overrideTimedOut parameter)
   * @param {boolean|undefined} [recursively] - whether or not to recursively complete all of this task's sub-tasks as well
   */
  complete(result, opts, recursively) {
    const overrideTimedOut = typeof opts === 'boolean' ? opts : opts && opts.overrideTimedOut;

    if (this.incomplete && (overrideTimedOut || !this.timedOut)) {
      this._state = TaskState.instances.Completed;
      this._result = result;
      this._error = undefined;
    }
    if (recursively) {
      this._subTasks.forEach(subTask => subTask.complete(result, opts, recursively));
    }
    // If this is a master task then ripple the state change and result to each of its slave tasks
    if (this.isMasterTask()) {
      this._slaveTasks.forEach(slaveTask => slaveTask.complete(result, opts, recursively));
    }
  }

  /**
   * Completes this task with a Succeeded state and the given optional result, but ONLY if the task is still incomplete
   * and EITHER NOT timed out OR overrideTimedOut is true. If recursively is true, then also succeeds any and all of its
   * subTasks recursively.
   *
   * @param {*} [result] - the optional result to store on the task
   * @param {CompleteOpts|boolean|undefined} [opts] - the optional options to use to modify the behaviour of this `succeed` method (if its a boolean, then treat it as a legacy overrideTimedOut parameter)
   * @param {boolean|undefined} [recursively] - whether or not to recursively succeed all of this task's sub-tasks as well
   */
  succeed(result, opts, recursively) {
    const overrideTimedOut = typeof opts === 'boolean' ? opts : opts && opts.overrideTimedOut;

    if (this.incomplete && (overrideTimedOut || !this.timedOut)) {
      this._state = TaskState.instances.Succeeded;
      this._result = result;
      this._error = undefined;
    }
    if (recursively) {
      this._subTasks.forEach(subTask => subTask.succeed(result, opts, recursively));
    }
    // If this is a master task then ripple the state change and result to each of its slave tasks
    if (this.isMasterTask()) {
      this._slaveTasks.forEach(slaveTask => slaveTask.succeed(result, opts, recursively));
    }
  }

  /**
   * Completes this this task with a completed state with the given state name and the given optional result, but ONLY
   * if the task is still incomplete and EITHER NOT timed out OR overrideTimedOut is true. If recursively is true, then
   * also completes any and all of its subTasks recursively.
   *
   * @param {string} stateName - the name of the complete state
   * @param {*} [result] - the optional result to store on the task
   * @param {CompleteOpts|boolean|undefined} [opts] - the optional options to use to modify the behaviour of this `completeAs` method (if its a boolean, then treat it as a legacy overrideTimedOut parameter)
   * @param {boolean|undefined} [recursively] - whether or not to recursively complete all of this task's sub-tasks as well
   */
  completeAs(stateName, result, opts, recursively) {
    const overrideTimedOut = typeof opts === 'boolean' ? opts : opts && opts.overrideTimedOut;

    if (this.incomplete && (overrideTimedOut || !this.timedOut)) {
      this._state = stateName === TaskState.names.Completed ? TaskState.instances.Completed :
        stateName === TaskState.names.Succeeded ? TaskState.instances.Succeeded : new states.CompletedState(stateName);
      this._result = result;
      this._error = undefined;
    }
    if (recursively) {
      this._subTasks.forEach(subTask => subTask.completeAs(stateName, result, opts, recursively));
    }
    // If this is a master task then ripple the state change and result to each of its slave tasks
    if (this.isMasterTask()) {
      this._slaveTasks.forEach(slaveTask => slaveTask.completeAs(stateName, result, opts, recursively));
    }
  }

  /**
   * Times out this task with a TimedOut state with the given error, but ONLY if the task is NOT already timed out,
   * rejected or failed and EITHER NOT completed OR overrideCompleted is true and EITHER NOT unstarted OR
   * overrideUnstarted is true. So by default, a timeout will ONLY take effect if the task is in a started state. If
   * recursively is true, then also times out any and all of its subTasks recursively.
   *
   * @param {Error|undefined} [error] - the optional error that triggered this timed out state
   * @param {TimeoutOpts|boolean|undefined} [opts] - the optional options to use to modify the behaviour of this `timeout` method (if its a boolean, then treat it as a legacy overrideCompleted parameter)
   * @param {boolean|undefined} [recursively] - whether or not to recursively timeout all of this task's sub-tasks as well
   */
  timeout(error, opts, recursively) {
    const overrideCompleted = typeof opts === 'boolean' ? opts : opts && opts.overrideCompleted;
    const overrideUnstarted = opts && opts.overrideUnstarted;
    const reverseAttempt = opts && opts.reverseAttempt;

    if ((overrideCompleted || !this.completed) && (overrideUnstarted || !this.unstarted) && !this.timedOut && !this.rejected && !this.failed) {
      if (!this.unstarted && reverseAttempt) {
        // Reverse the increment of the number of attempts that happened when this task was started, since we don't
        // consider a timeout to be a real attempt
        this.revertAttempts();
      }
      this._state = new states.TimedOut(error);
      this._result = undefined;
      this._error = error;
    }
    if (recursively) {
      this._subTasks.forEach(subTask => subTask.timeout(error, opts, recursively));
    }
    // If this is a master task then ripple the state change to each of its slave tasks
    if (this.isMasterTask()) {
      this._slaveTasks.forEach(slaveTask => slaveTask.timeout(error, opts, recursively));
    }
  }

  /**
   * Times out this task with a timed out state with the given name and optional error, but ONLY if the task is NOT
   * already timed out, rejected or failed and EITHER NOT completed OR overrideCompleted is true and EITHER NOT
   * unstarted OR overrideUnstarted is true. So by default, a timeout will ONLY take effect if the task is in a started
   * state. If recursively is true, then also times out any and all of its subTasks recursively.
   *
   * @param {string} stateName - the name of the timed out state
   * @param {Error|undefined} [error] - the optional error that triggered this timed out state
   * @param {TimeoutOpts|boolean} [opts] - the optional options to use to modify the behaviour of this `timeoutAs` method (if its a boolean, then treat it as a legacy overrideCompleted parameter)
   * @param {boolean|undefined} [recursively] - whether or not to recursively timeout all of this task's sub-tasks as well
   */
  timeoutAs(stateName, error, opts, recursively) {
    // Resolve options
    const overrideCompleted = typeof opts === 'boolean' ? opts : opts && opts.overrideCompleted;
    const overrideUnstarted = opts && opts.overrideUnstarted;
    const reverseAttempt = opts && opts.reverseAttempt;

    if ((overrideCompleted || !this.completed) && (overrideUnstarted || !this.unstarted) && !this.timedOut && !this.rejected && !this.failed) {
      if (!this.unstarted && reverseAttempt) {
        // Reverse the increment of the number of attempts that happened when this task was started, since we don't
        // consider a timeout to be a real attempt
        this.revertAttempts();
      }
      this._state = stateName === TaskState.names.TimedOut ? new states.TimedOut(error) :
        new states.TimedOutState(stateName, error);
      this._result = undefined;
      this._error = error;
    }
    if (recursively) {
      this._subTasks.forEach(subTask => subTask.timeoutAs(stateName, error, opts, recursively));
    }
    // If this is a master task then ripple the state change to each of its slave tasks
    if (this.isMasterTask()) {
      this._slaveTasks.forEach(slaveTask => slaveTask.timeoutAs(stateName, error, opts, recursively));
    }
  }

  /**
   * Fails this task with a Failed state with the given error and also fails any and all of its subTasks recursively (if
   * recursively is true).
   *
   * Note that failures are allowed to override a completed state, but NOT a timed out, rejected or existing failed state.
   *
   * @param {Error} error - the error that triggered the failed state
   * @param {boolean|undefined} [recursively] - whether or not to recursively fail all of this task's sub-tasks as well
   */
  fail(error, recursively) {
    if (!error) {
      throw new Error(`Cannot change task (${this.name}) state to failed without an error`);
    }
    if (!this.timedOut && !this.rejected && !this.failed) {
      this._state = new states.Failed(error);
      this._result = undefined;
      this._error = error;
    }
    if (recursively) {
      this._subTasks.forEach(subTask => subTask.fail(error, recursively));
    }
    // If this is a master task then ripple the state change to each of its slave tasks
    if (this.isMasterTask()) {
      this._slaveTasks.forEach(slaveTask => slaveTask.fail(error, recursively));
    }
  }

  /**
   * Fails this task with a failed state with the given state name and error and also fails any and all of its subTasks
   * recursively (if recursively is true).
   *
   * Note that failures are allowed to override a completed state, but NOT a timed out, rejected or existing failed state.
   *
   * @param {string} stateName - the name of the failed state
   * @param {Error} error - the error that triggered the failed state
   * @param {boolean|undefined} [recursively] - whether or not to recursively fail all of this task's sub-tasks as well
   */
  failAs(stateName, error, recursively) {
    if (!error) {
      throw new Error(`Cannot change task (${this.name}) state to failed without an error`);
    }
    if (!this.timedOut && !this.rejected && !this.failed) {
      this._state = stateName === TaskState.names.Failed ? new states.Failed(error) : new states.FailedState(stateName, error);
      this._result = undefined;
      this._error = error;
    }
    if (recursively) {
      this._subTasks.forEach(subTask => subTask.failAs(stateName, error, recursively));
    }
    // If this is a master task then ripple the state change to each of its slave tasks
    if (this.isMasterTask()) {
      this._slaveTasks.forEach(slaveTask => slaveTask.failAs(stateName, error, recursively));
    }
  }

  /**
   * If recursively is true, first attempts to recursively reject any and all of this task's sub-tasks. and then, if
   * this task is incomplete AND every one of its sub-tasks are fully finalised, rejects this task with a Rejected state
   * with the given reason and optional error. Rationale: Cannot reject a task with incomplete sub-tasks.
   * @param {string} reason - the reason this task is being rejected
   * @param {Error|undefined} [error] - an optional error that triggered this
   * @param {boolean|undefined} [recursively] - whether or not to recursively reject all of this task's sub-tasks as well
   * @returns {number} the number of tasks and sub-tasks actually rejected
   */
  reject(reason, error, recursively) {
    let count = 0;
    if (recursively) {
      count += this._subTasks.reduce((acc, subTask) => acc + subTask.reject(reason, error, recursively), 0);
    }
    // If this is a master task then ripple the state change to each of its slave tasks
    if (this.isMasterTask()) {
      this._slaveTasks.forEach(slaveTask => slaveTask.reject(reason, error, recursively));
    }
    if (this.incomplete && this._subTasks.every(t => t.isFullyFinalised())) {
      this._state = new states.Rejected(reason, error);
      this._result = undefined;
      this._error = error;
      return count + 1;
    }
    return count;
  }

  /**
   * If recursively is true, first attempts to recursively discard any and all of this task's sub-tasks, and then, if
   * this task is incomplete AND every one of its sub-tasks are fully finalised, rejects this task with a Discarded
   * state with the given reason and optional error. Rationale: Cannot discard a task with incomplete sub-tasks.
   * @param {string} reason - the reason this task is being discarded
   * @param {Error|undefined} [error] - an optional error that triggered this
   * @param {boolean|undefined} [recursively] - whether or not to recursively discard all of this task's sub-tasks as well
   * @returns {number} the number of tasks and sub-tasks actually discarded
   */
  discard(reason, error, recursively) {
    let count = 0;
    if (recursively) {
      count += this._subTasks.reduce((acc, subTask) => acc + subTask.discard(reason, error, recursively), 0);
    }
    // If this is a master task then ripple the state change to each of its slave tasks
    if (this.isMasterTask()) {
      this._slaveTasks.forEach(slaveTask => slaveTask.discard(reason, error, recursively));
    }
    if (this.incomplete && this._subTasks.every(t => t.isFullyFinalised())) {
      this._state = new states.Discarded(reason, error);
      this._result = undefined;
      this._error = error;
      return count + 1;
    }
    return count;
  }

  /**
   * If recursively is true, first attempts to recursively abandon any and all of this task's sub-tasks, and then, if
   * this task is incomplete AND every one of its sub-tasks are fully finalised, rejects this task with an Abandoned
   * state with the given reason and optional error. Rationale: Cannot abandon a task with incomplete sub-tasks.
   * @param {string} reason - the reason this task is being abandoned
   * @param {Error|undefined} [error] - an optional error that triggered this
   * @param {boolean|undefined} [recursively] - whether or not to recursively abandon all of this task's sub-tasks as well
   * @returns {number} the number of tasks and sub-tasks actually abandoned
   */
  abandon(reason, error, recursively) {
    let count = 0;
    if (recursively) {
      count += this._subTasks.reduce((acc, subTask) => acc + subTask.abandon(reason, error, recursively), 0);
    }
    // If this is a master task then ripple the state change to each of its slave tasks
    if (this.isMasterTask()) {
      this._slaveTasks.forEach(slaveTask => slaveTask.abandon(reason, error, recursively));
    }
    if (this.incomplete && this._subTasks.every(t => t.isFullyFinalised())) {
      this._state = new states.Abandoned(reason, error);
      this._result = undefined;
      this._error = error;
      return count + 1;
    }
    return count;
  }

  /**
   * If recursively is true, first attempts to recursively reject any and all of this task's sub-tasks. and then, if
   * this task is incomplete AND every one of its sub-tasks are fully finalised, rejects this task with a rejected state
   * with the given state name, reason and optional error. Rationale: Cannot reject a task with incomplete sub-tasks.
   * @param {string} stateName - the name of the rejected state
   * @param {string} reason - the reason this task is being rejected
   * @param {Error|undefined} [error] - an optional error that triggered this
   * @param {boolean|undefined} [recursively] - whether or not to recursively reject all of this task's sub-tasks as well
   * @returns {number} the number of tasks and sub-tasks actually rejected
   */
  rejectAs(stateName, reason, error, recursively) {
    let count = 0;
    if (recursively) {
      count += this._subTasks.reduce((acc, subTask) => acc + subTask.rejectAs(stateName, reason, error, recursively), 0);
    }
    // If this is a master task then ripple the state change to each of its slave tasks
    if (this.isMasterTask()) {
      this._slaveTasks.forEach(slaveTask => slaveTask.rejectAs(stateName, reason, error, recursively));
    }
    if (this.incomplete && this._subTasks.every(t => t.isFullyFinalised())) {
      this._state = stateName === TaskState.names.Rejected ? new states.Rejected(reason, error) :
        stateName === TaskState.names.Discarded ? new states.Discarded(reason, error) :
          stateName === TaskState.names.Abandoned ? new states.Abandoned(reason, error) :
            new states.RejectedState(stateName, reason, error);
      this._result = undefined;
      this._error = error;
      return count + 1;
    }
    return count;
  }

  // noinspection JSUnusedGlobalSymbols
  /**
   * If recursively is true, first attempts to recursively discard any and all of this task's over-attempted sub-tasks,
   * and then, if this task is incomplete, over-attempted AND every one of its sub-tasks are fully finalised, rejects
   * this task with a Discarded state with an appropriate over-attempted reason. Rationale: Cannot discard a task with
   * incomplete sub-tasks.
   * @param {number} maxNumberOfAttempts - the maximum number of attempts allowed
   * @param {boolean|undefined} [recursively] - whether or not to recursively discard all of this task's sub-tasks as well
   * @returns {number} the number of tasks and sub-tasks actually discarded
   */
  discardIfOverAttempted(maxNumberOfAttempts, recursively) {
    let count = 0;
    if (recursively) {
      count += this._subTasks.reduce((acc, subTask) => acc + subTask.discardIfOverAttempted(maxNumberOfAttempts, recursively), 0);
    }
    // If this is a master task then ripple the state change to each of its slave tasks
    if (this.isMasterTask()) {
      this._slaveTasks.forEach(slaveTask => slaveTask.discardIfOverAttempted(maxNumberOfAttempts, recursively));
    }
    if (this.incomplete && this._attempts >= maxNumberOfAttempts && this._subTasks.every(t => t.isFullyFinalised())) {
      const reason = `The number of attempts (${this._attempts}) has ${this._attempts > maxNumberOfAttempts ? 'exceeded' : 'reached'} the maximum number of attempts allowed (${maxNumberOfAttempts})`;
      this._state = new states.Discarded(reason);
      this._result = undefined;
      this._error = undefined;
      return count + 1;
    }
    return count;
  }

  /**
   * Notifies this task that its execute function has finished executing by setting its outcome to the given execution
   * `outcome`, which is either a Success with the value returned or a Failure with the error thrown by its execute
   * function, and by setting its "done" promise to the given `donePromise`, which only resolves when every one of the
   * outcome's promises (if any) resolve.
   * @param {Success|Failure} outcome - the success or failure outcome of this task's execution
   * @param {Promise} donePromise - the "done" promise
   */
  executed(outcome, donePromise) {
    this._outcome = outcome;
    this._donePromise = donePromise;
  }

  /**
   * Updates this task's status, attempts and result with that of the given prior version of this task (if any).
   *
   * NB: Use {@linkcode reconstructAllTasksFromRoot} to convert prior versions that are task-like objects, but not
   * tasks, back into tasks before using this method.
   *
   * @param {Task|undefined} oldTask - a task, which must be the prior version of this task (or undefined)
   * @param {TaskOpts|undefined} [opts] - optional options to use to alter the behaviour of any newly created sub-tasks
   * @returns {Task} this task (updated with its prior version's state, attempts and result)
   */
  updateFromPriorVersion(oldTask, opts) {
    if (!oldTask) {
      return this;
    }
    if (!isInstanceOf(oldTask, Task)) {
      throw new Error(`Cannot update task (${stringify(this)}) from a non-task, prior version (${stringify(oldTask)})`);
    }
    if (oldTask.name !== this.name) {
      throw new Error(`Cannot update task (${stringify(this)}) from mismatched prior version (${stringify(oldTask)})`);
    }

    if (oldTask._state) {
      // Set this task's state to the old task's state
      this._state = oldTask._state;

      // Set this task's result to the old task's result, but ONLY if the old state was completed; otherwise to undefined
      this._result = oldTask._state.completed ? oldTask._result : undefined;

      // Set this task's error to the old task's error, but ONLY if the old state was rejected; otherwise to undefined
      this._error = oldTask._state.rejected ? oldTask._error : undefined;
    }

    // Add the old task's number of attempts (if defined) to this task's number of attempts
    if (oldTask._attempts) {
      this._attempts += oldTask._attempts;
    }

    // Add the old task's total number of attempts (if defined) to this task's total number of attempts
    if (oldTask._totalAttempts) {
      this._totalAttempts += oldTask._totalAttempts;
    }

    // Copy the old task's began at time (if defined) to this task
    if (oldTask._began) {
      this._began = oldTask._began;
    }
    // Copy the old task's time taken in ms (if its a number) to this task
    if (typeof oldTask._took === 'number') {
      this._took = oldTask._took;
    }
    // Copy the old task's ended at time (if defined) to this task or re-calculate it from the old task's begin & took
    if (oldTask._ended) {
      this._ended = oldTask._ended;
    } else if (oldTask._began && typeof oldTask._took === 'number') {
      this._ended = calculateEnded(oldTask._began, oldTask._took);
    }

    // Recursively update the corresponding subTask for each of the old task's subTasks
    if (oldTask._subTasks && oldTask._subTasks.length > 0) {
      const oldSubTasks = oldTask._subTasks;
      for (let i = 0; i < oldSubTasks.length; ++i) {
        const oldSubTask = oldSubTasks[i];
        const subTask = this.getSubTask(oldSubTask.name); //subTasks.find(t => t.name === oldSubTask.name);
        if (subTask) {
          // Found the corresponding subTask for the old subTask, so recursively update its details
          subTask.updateFromPriorVersion(oldSubTask, opts);
        } else {
          // EITHER active sub-tasks have changed and no longer include this old sub-task OR the old sub-task was
          // dynamically added, so create a new (also unusable) copy of the "missing" unusable sub-task & update its
          // state from the old copy
          const newSubTask = new Task(oldSubTask.definition, this, this.factory, opts);
          newSubTask.updateFromPriorVersion(oldSubTask, opts);
          // console.warn(`Added an ${newSubTask.unusable ? 'unusable' : 'usable'} copy of prior ${oldSubTask.unusable ? 'unusable' : 'usable'} sub-task (${oldSubTask.name}), since it is not a predefined active sub-task of task (${this.name}) with subTasks ${stringify(this._subTasks.map(t => t.name))}`);
        }
      }
    }
    return this;
  }

  /**
   * Returns true if this task is a master task with slave tasks; false otherwise.
   * @returns {boolean} true if master task; false otherwise
   */
  isMasterTask() {
    return this._slaveTasks.length > 0;
  }

  /**
   * Sets this master task's and its corresponding sub-tasks' slave tasks to the given slave tasks and their sub-tasks
   * recursively and updates the master task (and recursively its sub-tasks) as follows:
   * 1. Sets its attempts & total attempts to the least of its slave tasks' attempts & total attempts respectively;
   * 2. Sets its began & ended date-times to those of its slave task with the most recent began date-time; and
   * 3. Sets its state to the "least advanced" state of all of its slave tasks (if its undefined or unstarted).
   * @param {Task[]} slaveTasks - the slave tasks of this master task
   * @returns {Task} this task
   */
  setSlaveTasks(slaveTasks) {
    const slaves = slaveTasks ? slaveTasks : [];
    // Set this master task's slave tasks to the given ones
    this._slaveTasks = slaves;

    // Set this master task's number of attempts to the minimum of all of its slave tasks' numbers of attempts
    // Set this master task's total attempts to the minimum of all of its slave tasks' total attempts
    // Set this master task's began & ended date-times to those of its slave task with the most recent began date-time
    // Set this master task's state to the "least advanced" state of all of its slave tasks (if its undefined or unstarted)
    let maxBegan = undefined;
    let andEnded = undefined;

    for (let i = 0; i < slaves.length; ++i) {
      const slave = slaves[i];

      const slaveTaskAttempts = slave._attempts;
      this._attempts = i === 0 ? slaveTaskAttempts : Math.min(this._attempts, slaveTaskAttempts);

      const slaveTaskTotalAttempts = slave._totalAttempts;
      this._totalAttempts = i === 0 ? slaveTaskTotalAttempts : Math.min(this._totalAttempts, slaveTaskTotalAttempts);

      const slaveBegan = slave._began;
      if (slaveBegan && (!maxBegan || slaveBegan > maxBegan)) {
        maxBegan = slaveBegan;
        andEnded = slave._ended ? slave._ended : calculateEnded(slaveBegan, slave._took);
      }
    }

    const states = slaves.map(s => s._state);
    const slaveState = states.length > 0 ? states.sort(TaskState.compareStates)[0] : undefined;
    if (slaveState && (!this._state || this._state.unstarted)) {
      this._state = slaveState;
    }

    this._began = maxBegan;
    this._ended = andEnded;
    this._took = calculateTook(maxBegan, andEnded);

    // Recursively do the same for each of this master task's sub-tasks
    for (let j = 0; j < this._subTasks.length; ++j) {
      const masterSubTask = this._subTasks[j];
      const slaveSubTasks = slaves.map(t => t.getSubTask(masterSubTask.name)).filter(s => !!s);
      masterSubTask.setSlaveTasks(slaveSubTasks);
    }
    return this;
  }

  /**
   * Freezes this task and all of its sub-tasks to prevent any further changes.
   */
  freeze() {
    if (!this._frozen) {
      // Recursively freeze each of this task's sub-tasks
      this._subTasks.forEach(subTask => subTask.freeze());

      // If this is a master task then freeze each of its slave tasks
      if (this.isMasterTask()) {
        this._slaveTasks.forEach(slaveTask => slaveTask.freeze());
      }

      // Freeze this task
      this._frozen = true;
      Object.freeze(this);
    }
    return this;
  }

  /**
   * Returns true if this task has been frozen; false otherwise.
   * @returns {boolean} true if frozen; otherwise false
   */
  isFrozen() {
    return this._frozen;
  }

  /**
   * Returns true if this task is unusable or false if its not. A task is considered to be unusable if its task
   * definition is marked as unusable.
   * @return {boolean} true if unusable; false otherwise
   */
  get unusable() {
    return !!this.definition && this.definition.unusable;
  }

  /**
   * Returns true if the given "task" object is either an instance of Task or is a Task-like object; false otherwise. An
   * object is deemed to be Task-like if it has a non-blank name (or type or kind) property; a boolean managed (or
   * executable) property; and either no sub-tasks or an array of sub-tasks; and additionally, if taskName is specified,
   * its name or its type (if it has no name) matches the given taskName.
   *
   * @param {*} task - the "task" object to check
   * @param {string|undefined} [taskName] - an optional task name to match against the "task" object's name - if omitted,
   * the "task" object's name can be any non-blank value
   * @returns {*|boolean}
   */
  static isTaskLike(task, taskName) {
    return isInstanceOf(task, Task) || (task && typeof task === 'object' &&
      (isNotBlank(task.name) || isNotBlank(task.type)) &&
      (task.managed === true || task.executable === true || task.executable === false || !task.managed) &&
      (!task.subTasks || Array.isArray(task.subTasks)) &&
      (!taskName || (task.name === taskName || (!task.name && task.type === taskName))));
  }

  /**
   * Collects all of the given task-like objects (or Tasks) and also all of their sub-tasks recursively.
   * @param {TaskLike[]|Task[]} taskLikes - the given list of task-like objects (or Tasks)
   * @returns {TaskLike[]|Task[]} the list of task-like objects (or Tasks) found and all of their sub-tasks recursively
   */
  static getTasksAndSubTasks(taskLikes) {
    const allTasksAndSubTasks = [];

    // Collect all tasks and all of their subtasks recursively
    taskLikes.forEach(task => Task.forEachTaskLike(task, t => allTasksAndSubTasks.push(t)));

    return allTasksAndSubTasks;
  }

  /**
   * Executes the given callback function on the given task-like object (or Task) and then recursively on all of its sub-tasks.
   * @param {TaskLike|Task} taskLike - a task-like object (or Task)
   * @param {Function} callback - a callback function
   */
  static forEachTaskLike(taskLike, callback) {
    callback(taskLike);
    if (taskLike.subTasks) {
      taskLike.subTasks.forEach(t => Task.forEachTaskLike(t, callback));
    }
  }

  /**
   * Cautiously attempts to get the root task for the given task by traversing up its task hierarchy using the parent
   * links, until it finds the root (i.e. a parent task with no parent). During this traversal, if any task is recursively
   * found to be a parent of itself, an error will be thrown.
   *
   * @param {Task} task - any task in the task hierarchy from which to start
   * @throws {Error} if any task is recursively a parent of itself
   * @returns {Task} the root task
   */
  static getRootTask(task) {
    if (!task || typeof task !== 'object') {
      return undefined;
    }

    function loop(task, history) {
      const parent = task.parent;
      if (!parent) {
        return task;
      }
      if (history.indexOf(task) !== -1) {
        // We have an infinite loop, since a previously visited task is recursively a parent of itself!
        throw new Error(`Task hierarchy is not a valid Directed Acyclic Graph, since task (${task.name}) is recursively a parent of itself!`)
      }
      history.push(task);
      return loop(parent, history);
    }

    return loop(task, []);
  }

  /**
   * Returns true if the proposed sub-task names together with the given parent task's sub-task names are all
   * still distinct; otherwise returns false.
   * @param {Task|undefined} [parent] - the optional parent task from which to gather its sub-tasks' names
   * @param {string|string[]} proposedSubTaskNames - the name (or names) of the proposed sub-task(s) to be checked
   */
  static areSubTaskNamesDistinct(parent, proposedSubTaskNames) {
    const oldNames = parent ? parent._subTasks.map(t => t.name) : [];
    const newNames = oldNames.concat(proposedSubTaskNames);
    return isDistinct(newNames);
  }


  /**
   * Ensures that the task hierarchies of both the given proposed task and of the given parent task (if any) are both
   * valid and could be safely combined into a single valid hierarchy; and, if not, throws an error.
   *
   * A valid hierarchy must only contain distinct tasks (i.e. every task can only appear once in its hierarchy). This
   * requirement ensures that a hierarchy is a Directed Acyclic Graph and avoids infinite loops.
   *
   * NB: The proposed task MUST NOT be linked to the given parent BEFORE calling this function (otherwise this function
   * will always throw an error) and MUST only be subsequently linked to the given parent if this function does NOT throw
   * an error.
   *
   * @param {Task|undefined} [parent] - an optional parent task (or sub-task) (if any), which identifies the first
   * hierarchy to check and to which the proposed task is intended to be linked
   * @param {Task|undefined} proposedTask - a optional proposed task, which identifies the second hierarchy to check
   * @throws {Error} if any task appears more than once in either hierarchy or in the proposed combination of both
   * hierarchies
   */
  static ensureAllTasksDistinct(parent, proposedTask) {
    // First find the root of the parent's task hierarchy
    const parentRoot = parent ? Task.getRootTask(parent) : undefined;
    // Next find the root of the proposed task's task hierarchy
    const proposedTaskRoot = proposedTask ? Task.getRootTask(proposedTask) : undefined;

    function loop(task, history) {
      if (!task) {
        return;
      }
      // Ensure that this task does not appear more than once in the hierarchy
      if (history.indexOf(task) !== -1) {
        // We have a problem with this task hierarchy, since a previously visited task appears more than once in the hierarchy!
        throw new Error(`Task hierarchy is not a valid Directed Acyclic Graph, since task (${task.name}) appears more than once in the hierarchy!`)
      }
      // Remember that we have seen this one
      history.push(task);

      // Now check all of its subTasks recursively too
      const subTasks = task._subTasks;
      for (let i = 0; i < subTasks.length; ++i) {
        loop(subTasks[i], history);
      }
    }

    const history = [];

    // Next loop from the parent's root down through all of its subTasks recursively, ensuring that there is no duplication
    // of any task in the parent's hierarchy
    loop(parentRoot, history);

    // Finally loop from the proposed task's root down through all of its subTasks recursively, ensuring that there is no
    // duplication of any task in either hierarchy
    loop(proposedTaskRoot, history);
  }

}

/**
 * Calculates the ended time from the given began time and took ms (if available).
 * @param {string|undefined} [began] - the ISO date-time at which this task's last execution began (or undefined if not executed yet)
 * @param {number|undefined} [took] - he number of milliseconds that this task's last execution took (or undefined if not executed yet)
 * @returns {string|undefined} the ended time; or undefined
 */
function calculateEnded(began, took) {
  if (!began || typeof took !== 'number') return undefined;
  try {
    return new Date(Date.parse(began) + took).toISOString();
  } catch (err) {
    console.error(`Failed to calculate ended time from began (${began}) & took (${took}) ms`, err);
    return undefined;
  }
}

// Install as a static method for convenience
if (!Task.calculateEnded) Task.calculateEnded = calculateEnded;

/**
 * Calculates the time taken in milliseconds from the given began time and ended time (if available).
 * @param {string|undefined} [began] - the ISO date-time at which this task's last execution began (or undefined if not executed yet)
 * @param {string|undefined} [ended] - the ISO date-time at which this task's last execution ended (or undefined if not executed yet)
 * @returns {number|undefined} the time taken in milliseconds; or undefined
 */
function calculateTook(began, ended) {
  if (!began || !ended) return undefined;
  try {
    return Date.parse(ended) - Date.parse(began);
  } catch (err) {
    console.error(`Failed to calculate time taken from began (${began}) & ended (${ended})`, err);
    return undefined;
  }
}

// Install as a static method for convenience
if (!Task.calculateTook) Task.calculateTook = calculateTook;

// Export the Task "class" / constructor function
module.exports = Task;