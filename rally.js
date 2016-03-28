function Rally() {
    this.init();

    this.ui = new RallyUI(this);
}

Rally.prototype = {
    instructions: [ ],
    instruction_map: new Map(),

    init: function() {
        var db = this.db = new Dexie('MyDatabase');

        // Define a schema
        db.version(1).stores({
            instructions: [ 'id++', '&instr', 'raw_mlg', 'cas', 'delay', 'mlg', 'time'].join()
        });

        // Open the database
        db.open()
            .catch(function(error){ alert('Uh oh : ' + error); });

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
        return this.db.instructions.toArray(function (instructions) {
            rally.instructions = instructions.sort(function (a,b) {
                return a.instr - b.instr;
            }).map(function (row) {
                var instr = new RallyInstruction(row);
                instr.calculate(rally, prev);
                rally.instruction_map.set(parseFloat(instr.instr), instr);
                instr.prev = prev;
                if (prev) {
                    prev.next = instr;
                }
                prev = instr;
                return instr;
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
        var row = new Object();

        row.instr = Number.parseFloat(arguments[0]);

        row.raw_mlg = null;
        row.cas = null;
        row.delay = null;
        row.mlg = null;
        row.time = null;

        switch (arguments.length) {
            case 6:
                row.time = Number.parseInt(arguments[5]);
            case 5:
                row.mlg = Number.parseFloat(arguments[4]);
            case 4:
                row.delay = Number.parseFloat(arguments[3]);
            case 3:
                row.cas = Number.parseInt(arguments[2]);
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
        var keys = Object.keys(this.instructions);
        var instr = 1;
        if (keys.length > 0) {
            var last = keys[keys.length - 1];
            instr = Number.parseFloat(last) + 1;
        }
        return this.addInstruction(instr);
    },

    setValue: function (id, col_index, val) {
        var rally = this;
        var col = RallyInstruction.prototype.columnDefs[col_index];
        var obj = {};
        obj[col.name] = val;

        this.db.instructions.update(id, obj).then(function () { rally.calculate(); }).catch(function (err) {
            console.log(instr);
            console.log(obj);
            debugger
        });
    },

    deleteInstruction: function(id) {
        var rally = this;
        this.db.instructions.where('id').equals(id).delete().then(function () {rally.calculate();});
    },

    odomFactor: function(val) {
        if (arguments.length > 0) {
            this.setConfig('odom_factor', val);
        }
        val = this.getConfig('odom_factor');
        if (val == null) {
            val = 1;
        }
        return Number.parseFloat(val);
    },

    casFactor: function(val) {
        if (arguments.length > 0) {
            this.setConfig('cas_factor', val);
        }
        val = this.getConfig('cas_factor');
        if (val == null) {
            val = 1;
        }
        return Number.parseFloat(val);
    },

    rallySpeed: function(val) {
        if (arguments.length > 0) {
            this.setConfig('rally_speed', val);
        }
        val = this.getConfig('rally_speed');
        if (val == null) {
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
        if (val == null) {
            val = 0;
        }
        return Number.parseInt(val);
    },

    timeSeconds: function(val) {
        if (arguments.length > 0) {
            this.setConfig('time_seconds', Boolean(val));
        }
        val = this.getConfig('time_seconds');
        if (val == null) {
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
};


function RallyInstruction(row) {
    Object.assign(this, row, {
        columns: [],
        prev: null,
        next: null,
    });

    var rally = this;
    this.columns = this.columnDefs.map(function (d) { return d.cloneWith(rally); });
}

RallyInstruction.prototype = {
    columnDefs: [],

    col: function(index) {
        var result = null;
        var int_index = -1;
        if (typeof index == 'string') {
            int_index = this.columns.findIndex(function (v) { return (v.name == index); });
        } else {
            int_index = index;
        }
        if (int_index < 0 || int_index >= this.columns.length) {
            throw new Error('Invalid index: ' + index);
        }
        return this.columns[int_index];
    },

    formatMilleage: function(val, places) {
        return Math.round(val * 1000) / 1000;
    },

    formatDeltaTime: function(seconds) {
        var minutes = ~~(seconds / 60);
        return minutes + ':' + Math.round(seconds * 100) / 100;
    },

    calculate: function(rally, prev) {
        var instr = this.col('instr');
        var raw_mlg = this.col('raw_mlg');
        var raw_d_mlg = this.col('raw_d_mlg');
        var mlg = this.col('mlg');
        var d_mlg = this.col('d_mlg');
        var cas = this.col('cas');
        var delay = this.col('delay');
        var tod = this.col('tod');
        var time = this.col('time');
        var d_time = this.col('d_time');

        if (prev) {
            p = new Object();
            p.instr = prev.col('instr');
            p.raw_mlg = prev.col('raw_mlg');
            p.raw_d_mlg = prev.col('raw_d_mlg');
            p.mlg = prev.col('mlg');
            p.d_mlg = prev.col('d_mlg');
            p.cas = prev.col('cas');
            p.delay = prev.col('delay');
            p.tod = prev.col('tod');
            p.time = prev.col('time');
            p.d_time = prev.col('d_time');
            prev = p;
        }

        this.columns.forEach(function (c) {
            if (c.isSet()) {
                c.calculated_value = c.value;
            }
        });

        var CalcPrev = function(col, default_value, calc_cb) {
            this.calc = function() {
                if (col.isSet()) {
                    col.calculated_value = col.value;
                } else if (prev && calc_cb) {
                    col.calculated_value = calc_cb()
                } else {
                    col.calculated_value = default_value;
                }
            };
        };

        var CalcCur = function(col, calc_cb) {
            this.calc = function() {
                col.calculated_value = calc_cb();
            };
        };

        calcFunctions = [
            new CalcPrev(raw_d_mlg, 0, function () {
                var result = raw_mlg.calculated_value - prev.raw_mlg.calculated_value;
                return (result < 0 ? 0 : result);
            }),
            new CalcCur(d_mlg, function() { return rally.adjustMilleage(raw_d_mlg.calculated_value); }),
            new CalcPrev(mlg, 0, function () {
                if (raw_mlg.calculated_value == 0) {
                    return 0;
                } else {
                    return prev.mlg.calculated_value + d_mlg.calculated_value;
                }
            }),
            new CalcPrev(cas, NaN, function () { return prev.cas.calculated_value; }),
            new CalcPrev(delay, 0, null),
            new CalcPrev(d_time, 0, function () { return (raw_d_mlg.calculated_value * 3600) / prev.cas.calculated_value + delay.calculated_value; }),
            new CalcPrev(time, 0, function () { return prev.time.calculated_value + d_time.calculated_value; }),
            new CalcPrev(tod, 0, function () {
                return prev.tod.calculated_value + (d_time.calculated_value * 1000);
            }),
            new CalcPrev(raw_mlg, 0, function () {
                if (mlg.isSet() && raw_mlg.value == null) {
                    return prev.raw_mlg.calculated_value + (mlg.calculated_value - prev.mlg.calculated_value);
                } else {
                    return 0;
                }
            }),
        ];

        calcFunctions.forEach(function (f) {
            f.calc();
        });
    },
};

RallyInstruction.prototype.Column = function(index, name, label, is_db, format_cb) {
    this.index = index;
    this.name = name;
    this.label = label;
    this.is_db = is_db;
    this.format_cb = format_cb;

    Object.defineProperty(this, 'value', {
        get: function() {
            if (this.instance) {
                return this.format_cb(this.instance[this.name]);
            }
        },
        set: function(v) {
            if (this.instance) {
                this.instance[this.name] = this.format_cb(v);
            }
        },
    });
    Object.defineProperty(this, 'display_value', {
        get: function() {
            if (this.instance) {
                return (this.isSet() ? this.value : this.calculated_value);
            }
        },
    });
};

RallyInstruction.prototype.Column.prototype = {
    index: null,
    name: null,
    label: null,
    is_db: null,
    calculated_value: null,
    instance: null,

    cloneWith: function(instance) {
        var clone = new RallyInstruction.prototype.Column();
        Object.assign(clone, this);
        clone.instance = instance;
        return clone;
    },

    isCalculated: function() {
        if (!this.instance) {
            throw "Instance not set";
        }
        return this.value == null;
    },

    isSet: function() {
        if (!this.instance) {
            throw "Instance not set";
        }
        return this.is_db && this.value != null;
    },

    toString: function() {
        return this.display_value;
    },
};

RallyInstruction.prototype.parseFixedFloat = function(f) {
    return function(v) {
        var result = Number.parseFloat(v);
        if (isNaN(result)) {
            result = null;
        } else {
            result = result.toFixed(f);
        }
        return result;
    };
}

RallyInstruction.prototype.parseFloat = function(v) {
    var result = Number.parseFloat(v);
    if (isNaN(result)) {
        result = null;
    }
    return result;
}

RallyInstruction.prototype.parseInt = function(v) {
    var result = Number.parseInt(v);
    if (isNaN(result)) {
        result = null;
    }
    return result;
}

RallyInstruction.prototype.columnDefs = [
    new RallyInstruction.prototype.Column(0,   'instr',        'Instr',            true,    RallyInstruction.prototype.parseFixedFloat(1)),
    new RallyInstruction.prototype.Column(1,   'raw_mlg',      'Raw Mlg',          true,    RallyInstruction.prototype.parseFloat),
    new RallyInstruction.prototype.Column(2,   'raw_d_mlg',    'Raw &Delta;Mlg',   false,   RallyInstruction.prototype.parseFloat),
    new RallyInstruction.prototype.Column(3,   'mlg',          'Mlg',              true,    RallyInstruction.prototype.parseFloat),
    new RallyInstruction.prototype.Column(4,   'd_mlg',        '&Delta;Mlg',       false,   RallyInstruction.prototype.parseFloat),
    new RallyInstruction.prototype.Column(5,   'cas',          'CAS',              true,    RallyInstruction.prototype.parseInt),
    new RallyInstruction.prototype.Column(6,   'delay',        'Delay',            true,    RallyInstruction.prototype.parseFloat),
    new RallyInstruction.prototype.Column(7,   'tod',          'TOD',              true,    RallyInstruction.prototype.parseInt),
    new RallyInstruction.prototype.Column(8,   'time',         'Time',             false,   RallyInstruction.prototype.parseInt),
    new RallyInstruction.prototype.Column(9,   'd_time',       '&Delta;Time',      false,   RallyInstruction.prototype.parseFloat),
];
