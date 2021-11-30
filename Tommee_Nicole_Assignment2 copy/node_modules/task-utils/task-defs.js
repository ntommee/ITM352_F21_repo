'use strict';

/**
 * A TaskDef class with static utilities for creating task definitions and sub-task definitions, which can be used to
 * define new executable tasks and both executable and non-executable sub-tasks.
 * @module task-utils/task-defs
 * @author Byron du Preez
 */

const isInstanceOf = require('core-functions/objects').isInstanceOf;

const Strings = require('core-functions/strings');
const isString = Strings.isString;
const isBlank = Strings.isBlank;
const isNotBlank = Strings.isNotBlank;

const Arrays = require('core-functions/arrays');
const isDistinct = Arrays.isDistinct;
const isArrayOfType = Arrays.isArrayOfType;

//======================================================================================================================
// TaskDef "class"
//======================================================================================================================

/**
 * A definition of a task or operation that defines a type of task to be executed and can be used to create tasks.
 * A task definition can be used to create either executable, self-managed tasks (if parent is undefined and execute is
 * defined); or executable, self-managed sub-tasks (if parent is defined and execute is defined) or non-executable,
 * externally managed sub-tasks (if parent is defined and execute is undefined).
 *
 * Rules:
 * - A top-level TaskDef, in a hierarchy of tasks and sub-tasks, must be an executable, self-managed task definition.
 *
 * - A task definition (regardless of whether it is executable or non-executable) can have either executable or
 *   non-executable, externally managed sub-task definitions.
 *
 * - All tasks in a hierarchy of tasks and sub-tasks must be unique.
 *
 * - All of a task's direct sub-task names must be unique.
 *
 * An executable sub-task is a task that must be explicitly executed by calling its `execute` method from within its
 * parent task's `execute` method and that must partially or entirely manage its own state within its `execute` method.
 *
 * A non-executable, externally managed sub-task is a task that must be manually executed from and must have its state
 * managed entirely by its parent task's `execute` method and that is ONLY used to enable tracking of its state.
 *
 */
class TaskDef {
  /**
   * Constructs an executable task definition, if the given parent is undefined and the given execute is a function;
   * or constructs an executable sub-task definition, if parent is defined and execute is a function; or constructs a
   * non-executable, externally managed sub-task definition, if parent is defined and execute is undefined; otherwise
   * throws an error.
   *
   * If parent is not specified, then this new task definition is assumed to be a top-level, executable task definition
   * and the given execute function must be defined and a valid function.
   *
   * If parent is specified, then this new task definition is assumed to be a sub-task definition of the given parent
   * task definition and the given execute function must be either undefined or a valid function.
   *
   * @param {string} name - the mandatory name of the task
   * @param {Function|undefined} [execute] - the optional function to be executed when a task created using this definition is started
   * @param {TaskDef|undefined} [parent] - an optional parent task definition
   * @param {TaskDefSettings|undefined} [settings] - optional settings to use to configure this task definition
   * @throws {Error} an error if the requested task definition is invalid
   */
  constructor(name, execute, parent, settings) {
    // Validate the given name
    // -----------------------------------------------------------------------------------------------------------------
    // Ensure name is a string and not blank
    if (!isString(name) || isBlank(name)) {
      throw new Error(`Cannot create a task definition with a ${!isString(name) ? "non-string" : "blank"} name (${JSON.stringify(name)})`);
    }
    const taskName = name.trim();
    const skipAddToParent = settings && settings.skipAddToParent;

    // Validate the given parent and the given execute function
    // -----------------------------------------------------------------------------------------------------------------
    if (parent) {
      // Creating a sub-task definition, so:
      // Ensure that the parent is a TaskDef itself
      if (!isInstanceOf(parent, TaskDef)) {
        throw new Error(`Cannot create a sub-task definition (${taskName}) with a parent that is not a task (or sub-task) definition`);
      }
      // Ensure that execute (if defined) is actually executable (i.e. a valid function)
      if (execute !== undefined && typeof execute !== 'function') {
        throw new Error(`Cannot create an executable sub-task definition (${taskName}) with an invalid execute function`);
      }
      // Ensure the parent's sub-task names will still be distinct if we include this new sub-task's name
      if (!skipAddToParent && !TaskDef.areSubTaskNamesDistinct(parent, taskName)) {
        throw new Error(`Cannot add a sub-task definition (${taskName}) with a duplicate name to parent (${parent.name}) with existing sub-task definitions ${JSON.stringify(parent.subTaskDefs.map(d => d.name))}`);
      }

    } else {
      // Creating an executable, top-level task definition, so:
      // Ensure that a top-level task definition does have an execute function, since a non-executable, top-level task would be useless
      if (!execute) {
        throw new Error(`Cannot create a top-level task definition (${taskName}) without an execute function)`);
      }
      // Ensure that execute (if defined) is actually executable (i.e. a valid function)
      if (typeof execute !== 'function') {
        throw new Error(`Cannot create a top-level task definition (${taskName}) with an invalid execute function`);
      }
    }

    // Finalise the new task definition's parent and execute
    const taskParent = parent ? parent : undefined; // or null?
    const managed = !execute || undefined;
    const taskExecute = execute || undefined;

    // Finally create each property as read-only (writable: false and configurable: false are defaults)
    // -----------------------------------------------------------------------------------------------------------------
    Object.defineProperty(this, 'name', {value: taskName, enumerable: true});
    Object.defineProperty(this, 'managed', {value: managed, enumerable: true});
    Object.defineProperty(this, 'execute', {value: taskExecute, enumerable: false});
    Object.defineProperty(this, 'subTaskDefs', {value: [], enumerable: true});

    // Set the optional describeItem function (if any provided)
    const describeItem = settings && typeof settings.describeItem === 'function' ? settings.describeItem : undefined;
    Object.defineProperty(this, 'describeItem', {value: describeItem, writable: true, enumerable: false});

    // Ensure that the proposed combined hierarchy to be formed from this new task definition and its parent
    // will still be valid and will ONLY contain distinct task definitions
    // -----------------------------------------------------------------------------------------------------------------
    if (taskParent) {
      // NB: Must check this after adding sub-tasks, but before setting parent!
      TaskDef.ensureAllTaskDefsDistinct(taskParent, this);
    }

    // Link this new task definition to its parent (if any)
    // -----------------------------------------------------------------------------------------------------------------
    Object.defineProperty(this, 'parent', {value: taskParent, enumerable: false});

    if (taskParent && !skipAddToParent) {
      taskParent.subTaskDefs.push(this);
    }
  }

  /**
   * Returns true if this defines executable tasks; false otherwise
   * @returns {boolean} true if executable; false otherwise
   */
  get executable() {
    return !this.managed;
  }

  /**
   * Marks this task definition as unusable (if true) or active (if false)
   * @param {boolean} unusable - whether this task definition is to be considered unusable or not (default undefined, i.e. not)
   */
  set unusable(unusable) {
    if (unusable)
      Object.defineProperty(this, '_unusable', {value: unusable, enumerable: false, writable: true, configurable: true});
    else
      delete this._unusable;
  }

  /**
   * Returns true if this task definition is marked as unusable or false if its not (i.e. if its active).
   * @return {boolean} true if unusable; false otherwise
   */
  get unusable() { return !!this._unusable; }

  /**
   * Sets this task definition's `describeItem` function to the given function (if it's a function) or sets it to
   * undefined (if it's NOT a function), but ONLY if either the definition's `describeItem is NOT already set or if the
   * given`overrideExisting` flag is true.
   * @param {DescribeItem|undefined} [describeItem] - sets the `describeItem` function to the given function
   * @param {boolean|undefined} [overrideExisting] - whether to override an existing `describeItem` function or not (default not)
   */
  setDescribeItem(describeItem, overrideExisting) {
    if (!this.describeItem || overrideExisting) {
      this.describeItem = typeof describeItem === 'function' ? describeItem : undefined;
    }
  }

  /**
   * Creates a new top-level, executable task definition to be used for creating executable tasks. Both the given name
   * and execute function MUST be correctly defined; otherwise an appropriate error will be thrown.
   *
   * As soon as you have defined your top-level task, you can start adding sub-task definitions to it (if necessary) using
   * {@linkcode TaskDef#defineSubTask} and/or {@linkcode TaskDef#defineSubTasks}, which return the newly created sub-task
   * definition(s).
   *
   * If any of your new sub-task definitions also need to have sub-task definitions of their own, then simply use exactly
   * the same procedure to add "sub-subTask" definitions to your sub-task definition.
   *
   * @param {string} taskName - the name of the task
   * @param {Function} execute - the function to be executed when a task created using this definition is started
   * @param {TaskDefSettings|undefined} [settings] - optional settings to use to configure this task definition
   * @throws {Error} if taskName or execute are invalid
   * @returns {TaskDef} a new executable task definition.
   */
  static defineTask(taskName, execute, settings) {
    return new TaskDef(taskName, execute, undefined, settings);
  }

  /**
   * Creates and adds an executable sub-task definition (if execute is defined) or a non-executable, managed sub-task
   * definition (if execute is undefined) with the given name to this task definition.
   * @param {string} subTaskName - the name of the new sub-task definition
   * @param {Function|undefined} [execute] - the optional function to be executed when a sub-task created using this definition is executed
   * @param {TaskDefSettings|undefined} [settings] - optional settings to use to configure this task definition
   * @throws {Error} an error if the given name is blank or not a string or not distinct
   */
  defineSubTask(subTaskName, execute, settings) {
    if (!isString(subTaskName) || isBlank(subTaskName)) {
      throw new Error(`Cannot create a sub-task definition with a ${!isString(subTaskName) ? "non-string" : "blank"} name (${JSON.stringify(subTaskName)})`);
    }
    const newName = subTaskName.trim();
    // Ensure that execute (if defined) is actually executable (i.e. a valid function)
    if (execute !== undefined && typeof execute !== 'function') {
      throw new Error(`Cannot create an executable sub-task definition (${newName}) with an invalid execute function`);
    }
    const skipAddToParent = settings && settings.skipAddToParent;
    // Ensure this task definition's sub-task names will still be distinct if we include the new sub-task's name
    if (!skipAddToParent && !TaskDef.areSubTaskNamesDistinct(this, newName)) {
      throw new Error(`Cannot add sub-task definition (${newName}) with a duplicate name to task definition (${this.name}) with existing sub-task definitions ${JSON.stringify(this.subTaskDefs.map(d => d.name))}`);
    }
    // Create and add the new sub-task definition to this task definition's list of sub-task definitions
    return new TaskDef(newName, execute, this, settings);
  }

  /**
   * Creates and adds multiple new non-executable, managed sub-task definitions with the given names to this task
   * definition.
   * @param {string[]} subTaskNames - the names of the new non-executable, managed sub-task definitions
   * @param {TaskDefSettings|undefined} [settings] - optional settings to use to configure these task definitions
   * @returns {TaskDef[]} an array of new sub-task definitions (one for each of the given names)
   */
  defineSubTasks(subTaskNames, settings) {
    if (!isArrayOfType(subTaskNames, "string")) {
      throw new Error(`Cannot create sub-task definitions with non-string names ${JSON.stringify(subTaskNames)}`);
    }
    if (subTaskNames.length > 0) {
      if (!subTaskNames.every(name => isNotBlank(name))) {
        throw new Error(`Cannot create sub-task definitions with blank names ${JSON.stringify(subTaskNames)}`);
      }
      const newNames = subTaskNames.map(n => n.trim());
      // Ensure this task definition's sub-task names will still be distinct if we include the new sub-task names
      if (!TaskDef.areSubTaskNamesDistinct(this, newNames)) {
        throw new Error(`Cannot add sub-task definitions ${JSON.stringify(newNames)} with duplicate names to task definition (${this.name}) with existing sub-task definitions ${JSON.stringify(this.subTaskDefs.map(d => d.name))}`);
      }
      // Create and add the new sub-task definitions to this task definition's list of sub-task definitions
      return newNames.map(name => new TaskDef(name, undefined, this, settings));
    }
    return [];
  }

  /**
   * Cautiously attempts to get the root task definition for the given task definition by traversing up its task
   * definition hierarchy using the parent links, until it finds the root (i.e. a parent task definition with no parent).
   * During this traversal, if any task definition is recursively found to be a parent of itself, an error will be thrown.
   *
   * @param {TaskDef} taskDef - any task definition in the task definition hierarchy from which to start
   * @throws {Error} if any task definition is recursively a parent of itself
   * @returns {TaskDef} the root task definition
   */
  static getRootTaskDef(taskDef) {
    if (!taskDef || typeof taskDef !== 'object') {
      return undefined;
    }

    function loop(def, history) {
      const parent = def.parent;
      if (!parent) {
        return def;
      }
      if (history.indexOf(def) !== -1) {
        // We have an infinite loop, since a previously visited task is recursively a parent of itself!
        throw new Error(`Task hierarchy is not a valid Directed Acyclic Graph, since task definition (${def.name}) is recursively a parent of itself!`)
      }
      history.push(def);
      return loop(parent, history);
    }

    return loop(taskDef, []);
  }

  /**
   * Ensures that the task definition hierarchies of both the given proposed task definition and of the given parent task
   * definition (if any) are both valid and could be safely combined into a single valid hierarchy; and, if not, throws an
   * error.
   *
   * A valid hierarchy must only contain distinct task definitions (i.e. every task definition can only appear once in its
   * hierarchy). This requirement ensures that a hierarchy is a Directed Acyclic Graph and avoids infinite loops.
   *
   * NB: The proposed task definition MUST NOT be linked to the given parent BEFORE calling this function (otherwise
   * this function will always throw an error) and MUST only be subsequently linked to the given parent if this function
   * does NOT throw an error.
   *
   * @param {TaskDef|undefined} [parent] - an optional parent task (or sub-task) definition (if any), which identifies the
   * first hierarchy to check and to which the proposed task definition is intended to be linked
   * @param {TaskDef|undefined} proposedTaskDef - a optional proposed task definition, which identifies the second
   * hierarchy to check
   * @throws {Error} if any task definition appears more than once in either hierarchy or in the proposed combination of
   * both hierarchies
   */
  static ensureAllTaskDefsDistinct(parent, proposedTaskDef) {
    // First find the root of the parent's task hierarchy
    const parentRoot = parent ? TaskDef.getRootTaskDef(parent) : undefined;
    // Next find the root of the proposed task definition's task hierarchy
    const proposedTaskDefRoot = proposedTaskDef ? TaskDef.getRootTaskDef(proposedTaskDef) : undefined;

    function loop(taskDef, history) {
      if (!taskDef) {
        return;
      }
      // Ensure that this definition does not appear more than once in the hierarchy
      if (history.indexOf(taskDef) !== -1) {
        // We have a problem with this task hierarchy, since a previously visited task definition appears more than once in the hierarchy!
        throw new Error(`Task hierarchy is not a valid Directed Acyclic Graph, since task definition (${taskDef.name}) appears more than once in the hierarchy!`)
      }
      // Remember that we have seen this one
      history.push(taskDef);

      // Now check all of its sub-task definitions recursively too
      const subTaskDefs = taskDef.subTaskDefs;
      for (let i = 0; i < subTaskDefs.length; ++i) {
        loop(subTaskDefs[i], history);
      }
    }

    const history = [];

    // Next loop from the parent's root down through all of its sub-task definitions recursively, ensuring that there is no
    // duplication of any task definition in the parent's hierarchy
    loop(parentRoot, history);

    // Finally loop from the proposed task definition's root down through all of its sub-task definitions recursively,
    // ensuring that there is no duplication of any task definition in either hierarchy
    loop(proposedTaskDefRoot, history);
  }

  /**
   * Returns true if the proposed sub-task names together with the given parent task definition's sub-task names are all
   * still distinct; otherwise returns false.
   * @param parent
   * @param {string|string[]} proposedNames - the name or names of the proposed sub-task definitions to be checked
   */
  static areSubTaskNamesDistinct(parent, proposedNames) {
    const oldNames = parent ? parent.subTaskDefs.map(d => d.name) : [];
    const newNames = oldNames.concat(proposedNames);
    return isDistinct(newNames);
  }

}

// Export the TaskDef "class" / constructor function
module.exports = TaskDef;