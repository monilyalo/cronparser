function Cron() {}

/**
 * Days in month
 * @type {number[]}
 */
Cron.daysInMonth = [
  31,
  29,
  31,
  30,
  31,
  30,
  31,
  31,
  30,
  31,
  30,
  31
];

Cron._sortCompareFn = function(a, b) {
  var aIsNumber = typeof a === 'number';
  var bIsNumber = typeof b === 'number';

  if (aIsNumber && bIsNumber) {
      return a - b;
  }

  if (!aIsNumber && bIsNumber) {
      return 1;
  }

  if (aIsNumber && !bIsNumber) {
      return -1;
  }

  return a.localeCompare(b);
};

Cron._handleMaxDaysInMonth = function(mappedFields) {
  // Filter out any day of month value that is larger than given month expects
  if (mappedFields.month.length === 1) {
      var daysInMonth = Cron.daysInMonth[mappedFields.month[0] - 1];

      return mappedFields['day of month']
          .filter(function(a) {
              return a === 'L' ? true : a <= daysInMonth;
          })
          .sort(Cron._sortCompareFn);
  }
};

/**
* Field aliases
* @type {Object}
*/
Cron.aliases = {
  month: {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12
  },

  'day of week': {
      sun: 0,
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6
  }
};

Cron._isValidConstraintChar = function _isValidConstraintChar(constraints, value) {
  if (typeof value !== 'string') {
      return false;
  }

  return constraints.chars.some(function(char) {
      return value.indexOf(char) > -1;
  });
};

/**
* Parse input interval
*
* @param {String} field Field symbolic name
* @param {String} value Field value
* @param {Array} constraints Range upper and lower constraints
* @return {Array} Sequence of sorted values
* @private
*/
Cron._parseField = function _parseField(field, value, constraints) {
  // Replace aliases
  switch (field) {
      case 'month':
      case 'day of week':
          var aliases = Cron.aliases[field];
          value = value.replace(/[a-z]{3}/gi, function(match) {
              match = match.toLowerCase();

              if (typeof aliases[match] !== 'undefined') {
                  return aliases[match];
              }
          });
          break;
  }

  // Replace '*' and '?'
  if (value.indexOf('*') !== -1) {
      value = value.replace(/\*/g, constraints.min + '-' + constraints.max);
  } else if (value.indexOf('?') !== -1) {
      value = value.replace(/\?/g, constraints.min + '-' + constraints.max);
  }

  //
  // Inline parsing functions
  //
  // Parser path:
  //  - parseSequence
  //    - parseRepeat
  //      - parseRange

  /**
   * Parse sequence
   *
   * @param {String} val
   * @return {Array}
   * @private
   */
  function parseSequence(val) {
      var stack = [];

      function handleResult(result) {
          if (result instanceof Array) { // Make sequence linear
              for (var i = 0, c = result.length; i < c; i++) {
                  var value = result[i];

                  if (Cron._isValidConstraintChar(constraints, value)) {
                      stack.push(value);
                      continue;
                  }
                  // Check constraints
                  if (typeof value !== 'number' || Number.isNaN(value) || value < constraints.min || value > constraints.max) {
                      throw new Error(
                          'Constraint error, got value ' + value + ' expected range ' +
                          constraints.min + '-' + constraints.max
                      );
                  }

                  stack.push(value);
              }
          } else { // Scalar value

              if (Cron._isValidConstraintChar(constraints, result)) {
                  stack.push(result);
                  return;
              }

              var numResult = +result;

              // Check constraints
              if (Number.isNaN(numResult) || numResult < constraints.min || numResult > constraints.max) {
                  throw new Error(
                      'Constraint error, got value ' + result + ' expected range ' +
                      constraints.min + '-' + constraints.max
                  );
              }

              if (field === 'day of week') {
                  numResult = numResult % 7;
              }

              stack.push(numResult);
          }
      }

      var atoms = val.split(',');
      if (!atoms.every(function(atom) {
              return atom.length > 0;
          })) {
          throw new Error('Invalid list value format');
      }

      if (atoms.length > 1) {
          for (var i = 0, c = atoms.length; i < c; i++) {
              handleResult(parseRepeat(atoms[i]));
          }
      } else {
          handleResult(parseRepeat(val));
      }

      stack.sort(Cron._sortCompareFn);

      return stack;
  }

  /**
   * Parse repetition interval
   *
   * @param {String} val
   * @return {Array}
   */
  function parseRepeat(val) {
      var repeatInterval = 1;
      var atoms = val.split('/');

      if (atoms.length > 1) {
          if (atoms[0] == +atoms[0]) {
              atoms = [atoms[0] + '-' + constraints.max, atoms[1]];
          }
          return parseRange(atoms[0], atoms[atoms.length - 1]);
      }

      return parseRange(val, repeatInterval);
  }

  /**
   * Parse range
   *
   * @param {String} val
   * @param {Number} repeatInterval Repetition interval
   * @return {Array}
   * @private
   */
  function parseRange(val, repeatInterval) {
      var stack = [];
      var atoms = val.split('-');

      if (atoms.length > 1) {
          // Invalid range, return value
          if (atoms.length < 2) {
              return +val;
          }

          if (!atoms[0].length) {
              if (!atoms[1].length) {
                  throw new Error('Invalid range: ' + val);
              }

              return +val;
          }

          // Validate range
          var min = +atoms[0];
          var max = +atoms[1];

          if (Number.isNaN(min) || Number.isNaN(max) ||
              min < constraints.min || max > constraints.max) {
              throw new Error(
                  'Constraint error, got range ' +
                  min + '-' + max +
                  ' expected range ' +
                  constraints.min + '-' + constraints.max
              );
          } else if (min >= max) {
              throw new Error('Invalid range: ' + val);
          }

          // Create range
          var repeatIndex = +repeatInterval;

          if (Number.isNaN(repeatIndex) || repeatIndex <= 0) {
              throw new Error('Constraint error, cannot repeat at every ' + repeatIndex + ' time.');
          }

          for (var index = min, count = max; index <= count; index++) {
              if (repeatIndex > 0 && (repeatIndex % repeatInterval) === 0) {
                  repeatIndex = 1;
                  stack.push(index);
              } else {
                  repeatIndex++;
              }
          }

          return stack;
      }

      return Number.isNaN(+val) ? val : +val;
  }

  return parseSequence(value);
};

/**
* Fields constraints
* @type {Array}
*/
Cron.constraints = [{
      min: 0,
      max: 59,
      chars: []
  }, // Minute
  {
      min: 0,
      max: 23,
      chars: []
  }, // Hour
  {
      min: 1,
      max: 31,
      chars: ['L']
  }, // Day of month
  {
      min: 1,
      max: 12,
      chars: []
  }, // Month
  {
      min: 0,
      max: 7,
      chars: ['L']
  }, // Day of week
];

Cron.map = ['minute', 'hour', 'day of month', 'month', 'day of week'];
/**
* Field defaults
* @type {Array}
*/
Cron.parseDefaults = ['*', '*', '*', '*', '*'];

Cron.parse = function parse(expression) {
  // Split fields
  var fields = [];
  var atoms = (expression + '').trim().split(/\s+/);

  // Resolve fields
  var start = (Cron.map.length - atoms.length);
  for (var i = 0, c = Cron.map.length; i < c; ++i) {
      var field = Cron.map[i]; // Field name
      var value = atoms[atoms.length > c ? i : i - start]; // Field value

      if (i < start || !value) { // Use default value
          fields.push(Cron._parseField(
              field,
              Cron.parseDefaults[i],
              Cron.constraints[i]
          ));
      } else {
          fields.push(Cron._parseField(
              field,
              value,
              Cron.constraints[i]
          ));
      }
  }

  var mappedFields = {};
  for (var i = 0, c = Cron.map.length; i < c; i++) {
      var key = Cron.map[i];
      mappedFields[key] = fields[i].join(' ');
  }

  var dayOfMonth = Cron._handleMaxDaysInMonth(mappedFields);
  mappedFields['day of month'] = dayOfMonth || mappedFields['day of month'];

  mappedFields.command = atoms[atoms.length - 1]

  return mappedFields
}

module.exports = Cron;