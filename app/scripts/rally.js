(function () {
'use strict';

window.Rally = function() {
    this.init();

    this.ui = new RallyUI(this);
};

Rally.prototype = {
    instructions: [ ],
    instruction_map: new Map(),
    instruction_id_map: new Map(),
    last_instr: null,

    init: function() {
        var db = this.db = new Dexie('MyDatabase');

        // Define a schema
        db.version(1).stores({
            instructions: [ 'id++', '&instr', 'raw_mlg', 'cas', 'delay', 'mlg', 'time'].join()
        });

        // Open the database
        db.open()
            .catch(function(error){ alert('Uh oh : ' + error); });

        this.last_instr = 0;
        this.calculate();

        this.cachedClockAdj = this.clockAdj();
    },

    cachedClockAdj: 0,

    now: function() {
        return Date.now() + this.cachedClockAdj;
    },

    calculate: function() {
        var rally = this;
        var prev = null;
        this.instruction_map.clear();
        this.instruction_id_map.clear();
        return this.db.instructions.toArray(function (rows) {
            rally.instructions = rows.sort(function (a,b) {
                return a.instr - b.instr;
            }).map(function (row) {
                var instruction = new RallyInstruction(row);
                instruction.calculate(rally, prev);
                rally.instruction_map.set(parseFloat(instruction.instr), instruction);
                rally.instruction_id_map.set(instruction.id, instruction);
                rally.last_instr = instruction.instr.value;
                instruction.prev = prev;
                if (prev) {
                    prev.next = instruction;
                }
                prev = instruction;
                return instruction;
            });
            rally.ui.renderInstructions();
        });
    },

    instruction: function (instr) {
        instr = parseFloat(instr);
        if (this.instruction_map.has(instr)) {
            return this.instruction_map.get(instr);
        } else {
            return null;
        }
    },

    addInstruction: function() {
        var row = {};

        row.instr = Number.parseFloat(arguments[0]);

        if (this.instruction_map.has(row.instr)) {
            throw new Error("Instruction numbers must be unique");
        }

        row.raw_mlg = null;
        row.cas = null;
        row.delay = null;
        row.mlg = null;
        row.time = null;

        switch (arguments.length) {
            case 6:
                row.time = Number.parseInt(arguments[5]);
                /* falls through */
            case 5:
                row.mlg = Number.parseFloat(arguments[4]);
                /* falls through */
            case 4:
                row.delay = Number.parseFloat(arguments[3]);
                /* falls through */
            case 3:
                row.cas = Number.parseInt(arguments[2]);
                /* falls through */
            case 2:
                row.raw_mlg = Number.parseFloat(arguments[1]);
                break;
        }

        var rally = this;
        return this.db.instructions.put(row).then(function () {
            return rally.calculate().then(function() {
                return row.instr;
            });
        });
    },

    addNextInstruction: function() {
        this.last_instr = Math.floor(this.last_instr + 1);
        return this.addInstruction(this.last_instr);
    },

    setValue: function (instruction, col, val) {
        var rally = this;
        var obj = {};
        if (col.name == 'instr') {
            val = rally.parseInstruction(col.format_cb(val));
        } else if (col.name == 'tod') {
            val = rally.parseTime(val);
        } else {
            val = col.format_cb(val);
        }
        obj[col.name] = val;

        this.db.instructions.update(instruction.id, obj).then(function () { rally.calculate(); }).catch(function (err) {
            console.log(instr);
            console.log(obj);
        });
    },

    deleteInstruction: function(instruction) {
        var rally = this;
        if (instruction && this.last_instr == instruction.instr.value) {
            if (instruction.prev) {
                this.last_instr = instruction.prev.instr.value;
            } else {
                this.last_instr = 0;
            }
        }
        rally.db.instructions.where('id')
            .equals(instruction.id)
            .delete()
            .then(function () {
                rally.calculate();
            });
    },

    odomFactor: function(val) {
        if (arguments.length > 0) {
            this.setConfig('odom_factor', val);
        }
        val = this.getConfig('odom_factor');
        if (val === null) {
            val = 1;
        }
        return Number.parseFloat(val);
    },

    casFactor: function(val) {
        if (arguments.length > 0) {
            this.setConfig('cas_factor', val);
        }
        val = this.getConfig('cas_factor');
        if (val === null) {
            val = 1;
        }
        return Number.parseFloat(val);
    },

    rallySpeed: function(val) {
        if (arguments.length > 0) {
            this.setConfig('rally_speed', val);
        }
        val = this.getConfig('rally_speed');
        if (val === null) {
            val = 1;
        }
        return Number.parseInt(val);
    },

    clockAdj: function(val) {
        if (arguments.length > 0) {
            this.setConfig('clock_adj', val);
            this.cachedClockAdj = this.clockAdj();
        }
        val = this.getConfig('clock_adj');
        if (val === null) {
            val = 0;
        }
        return Number.parseInt(val);
    },

    timeSeconds: function(val) {
        if (arguments.length > 0) {
            this.setConfig('time_seconds', Boolean(val));
        }
        val = this.getConfig('time_seconds');
        if (val === null) {
            val = true;
        } else {
            val = (val.toLowerCase() == "true");
        }
        return Boolean(val);
    },

    adjustMilleage: function(val) {
        return Number.parseFloat(val) * this.odomFactor();
    },

    adjustCAS: function(val) {
        return Number.parseFloat(val) * this.casFactor();
    },

    getConfig: function(name) {
        return window.localStorage.getItem(name);
    },

    setConfig: function(name, value) {
        return window.localStorage.setItem(name, value);
    },

    reset: function() {
        this.db.delete();
        this.init();
    },

    parseInstruction: function(v) {
        if (v === null || isNaN(v)) {
            throw new Error("Invalid format for instruction");
        }
        if (this.instruction_map.has(v)) {
            throw new Error("Instruction numbers must be unique");
        }
        return v;
    },

    parseTime: function(v) {
        var result = null;
        if (v !== null) {
            if (!v.match(/^\s*[0-9:.]+(\s*[pamPAM]+)?\s*$/)) {
                throw new Error("Invalid time format");
            }
            if (this.timeSeconds()) {
                result = moment(v, ["h-m-s", "h-m", "H-m A"]);
            } else {
                if (typeof v == 'string' && v.includes('.')) {
                    var m = null;
                    m = v.match(/^\s*(([0-9]+):)?([0-9]+)\.([0-9]+)(\s*[pamPAM]+)?\s*$/);
                    if (m) {
                        result = moment({h: m[2], m: m[3]});
                        result.add(Number.parseFloat('0.'+m[4]) * 60, 'seconds');
                    } else {
                        throw new Error("Invalid time format");
                    }
                } else {
                    result = moment(v, ["h-m-s", "h-m", "H-m A"]);
                }
            }
            if (result.isValid()) {
                result = result.valueOf();
            } else {
                result = null;
            }
        }
        return result;
    },

};


window.RallyInstruction = function(row) {
    this.id = row.id;
    this.columns = [];
    this.columns_calc_order = [];

    var instruction = this;
    this.column_defs_display_order.forEach(function (def) {
        var val = null;
        if (row.hasOwnProperty(def.name)) {
            val = row[def.name];
        }
        var col = new RallyInstructionColumn(val, def);
        instruction.columns.push(col);
        Object.defineProperty(instruction, col.name, {
            get: function() {
                return col;
            },
        });
    });
    this.column_defs_calc_order.forEach(function (name) {
        instruction.columns_calc_order.push(instruction[name]);
    });
};

RallyInstruction.prototype = {
    column_defs_display_order: [],
    column_defs_by_name: {},
    column_defs_calc_order: [],

    parseFixedFloat: function(f) {
        return function(v) {
            var result = Number.parseFloat(v);
            if (isNaN(result)) {
                result = null;
            } else {
                result = result.toFixed(f);
            }
            return result;
        };
    },

    parseFloat: function(v) {
        var result = Number.parseFloat(v);
        if (isNaN(result)) {
            result = null;
        }
        return result;
    },

    parseInt: function(v) {
        var result = Number.parseInt(v);
        if (isNaN(result)) {
            result = null;
        }
        return result;
    },

    calculate: function(rally, prev) {
        var cur = this;
        this.columns_calc_order.forEach(function (c) {
            c.calc(rally, prev, cur);
        });
    },
};

window.RallyInstructionColumn = function(value, props) {
    this.name = props.name;
    this.label = props.label;
    this.default_value = props.default_value;
    this.format_cb = props.format_cb;
    this.calc_if_prev_cb = props.calc_if_prev_cb;
    this.calc_always_cb = props.calc_always_cb;
    this.read_only = (props.read_only ? true : false);

    this.calculated_value = value;
    this.stored_value = value;

    Object.defineProperty(this, 'value', {
        get: function() {
            return (this.stored_value !== null ? this.stored_value : this.calculated_value);
        },
    });
};

RallyInstructionColumn.prototype = {
    calc: function(rally, prev, cur) {
        var val = null;
        if (this.isSet()) {
            val = this.value;
        } else if (this.calc_always_cb) {
            val = this.calc_always_cb.apply(this, arguments);
        } else if (prev && this.calc_if_prev_cb) {
            val = this.calc_if_prev_cb.apply(this, arguments);
        } else {
            val = this.default_value;
        }
        this.calculated_value = val;
    },

    isSet: function() {
        return this.stored_value !== null;
    },

    toString: function() {
        var value = this.value;
        if (this.format_cb) {
            value = this.format_cb(value);
        }
        return value;
    },
};


RallyInstruction.prototype.column_defs_display_order = [
    {
        name: 'instr',
        label: 'Instr',
        format_cb: RallyInstruction.prototype.parseFixedFloat(1),
    }, {
        name: 'raw_mlg',
        label: 'Raw Mlg',
        default_value: 0,
        format_cb: RallyInstruction.prototype.parseFloat,
        calc_if_prev_cb: function(rally, prev, cur) {
            if (cur.mlg.isSet() && !cur.raw_mlg.isSet()) {
                return prev.raw_mlg.value + (cur.mlg.value - prev.mlg.value);
            } else {
                return 0;
            }
        },
    }, {
        name: 'raw_d_mlg',
        label: 'Raw &Delta;Mlg',
        read_only: true,
        default_value: 0,
        format_cb: RallyInstruction.prototype.parseFloat,
        calc_if_prev_cb: function(rally, prev, cur) {
            var result = cur.raw_mlg.value - prev.raw_mlg.value;
            return (result < 0 ? 0 : result);
        },
    }, {
        name: 'mlg',
        label: 'Mlg',
        default_value: 0,
        format_cb: RallyInstruction.prototype.parseFloat,
        calc_if_prev_cb: function(rally, prev, cur) {
            if (cur.raw_mlg.value === 0) {
                return 0;
            } else {
                return prev.mlg.value + cur.d_mlg.value;
            }
        },
    }, {
        name: 'd_mlg',
        label: '&Delta;Mlg',
        read_only: true,
        default_value: 0,
        format_cb: RallyInstruction.prototype.parseFloat,
        calc_always_cb: function(rally, prev, cur) {
            return rally.adjustMilleage(cur.raw_d_mlg.value);
        },
    }, {
        name: 'cas',
        label: 'CAS',
        default_value: 0,
        format_cb: RallyInstruction.prototype.parseInt,
        calc_if_prev_cb: function(rally, prev, cur) {
            return prev.cas.value;
        },
    }, {
        name: 'delay',
        label: 'Delay',
        default_value: 0,
        format_cb: RallyInstruction.prototype.parseFloat,
    }, {
        name: 'tod',
        label: 'TOD',
        format_cb: RallyInstruction.prototype.parseInt,
        calc_if_prev_cb: function(rally, prev, cur) {
            var value = prev.tod.value;
            value += (cur.d_time.value + prev.err_time.value) * 1000;
            return value;
        },
    }, {
        name: 'time',
        label: 'Time',
        default_value: 0,
        read_only: true,
        format_cb: RallyInstruction.prototype.parseInt,
        calc_if_prev_cb: function(rally, prev, cur) {
            return prev.time.value + cur.d_time.value;
        },
    }, {
        name: 'd_time',
        label: '&Delta;Time',
        default_value: 0,
        read_only: true,
        format_cb: RallyInstruction.prototype.parseFloat,
        calc_if_prev_cb: function(rally, prev, cur) {
            var value = cur.raw_d_mlg.value * 3600;
            value /= prev.cas.value;
            value += cur.delay;
            return value;
        },
    }, {
        name: 'err_time',
        label: 'Err Time',
        default_value: 0,
        read_only: true,
        format_cb: RallyInstruction.prototype.parseFloat,
        calc_if_prev_cb: function(rally, prev, cur) {
            var value = 0;
            if (cur.tod.isSet()) {
                value = prev.tod.value - cur.tod.value;
                value /= 1000;
                value += cur.d_time.value + prev.err_time.value;
            }
            return value;
        },
    },
];

RallyInstruction.prototype.column_defs_display_order.forEach(function (col) {
    RallyInstruction.prototype.column_defs_by_name[col.name] = col;
});

RallyInstruction.prototype.column_defs_calc_order = [
    'instr',
    'raw_d_mlg',
    'd_mlg',
    'mlg',
    'cas',
    'd_time',
    'time',
    'tod',
    'raw_mlg',
    'err_time',
];

}());