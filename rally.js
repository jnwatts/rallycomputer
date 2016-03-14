function Rally() {
    this.init();

    this.ui = new RallyUI(this);
}

Rally.prototype = {
    db_columns: [ 'instr', 'raw_mlg', 'cas', 'delay', 'mlg', 'abs_time', 'is_omp', 'is_cp' ],
    instructions: [ ],

    init: function() {
        var db = this.db = new Dexie('MyDatabase');

        // Define a schema
        db.version(1)
            .stores({
                instructions: Rally.prototype.db_columns.join()
            });

        db.instructions.mapToClass(RallyInstruction);

        // Open the database
        db.open()
            .catch(function(error){ alert('Uh oh : ' + error); });

        this.calculate();
    },

    calculate: function() {
        var rally = this;
        var prev = null;
        rally.instructions = [];
        this.db.instructions.each(function (instr) {
            instr.calculate(rally, prev);
            rally.instructions[instr.instr] = instr;
            instr.prev = prev;
            if (prev) {
                prev.next = instr;
            }
            prev = instr;
        }).then(function (e) {
            rally.ui.renderInstructions();
        });
    },

    addInstruction: function() {
        var row = new Object();

        row.instr = Number.parseFloat(arguments[0]);
        row.raw_mlg = Number.parseFloat(arguments[1]);

        row.cas = null;
        row.delay = null;
        row.mlg = null;
        row.abs_time = null;
        row.is_cp = false;
        row.is_omp = false;

        switch (arguments.length) {
            case 8:
                row.is_cp = !!arguments[7];
            case 7:
                row.is_omp = !!arguments[6];
            case 6:
                row.abs_time = Number.parseInt(arguments[5]);
            case 5:
                row.mlg = Number.parseFloat(arguments[4]);
            case 4:
                row.delay = Number.parseFloat(arguments[3]);
            case 3:
                row.cas = Number.parseInt(arguments[2]);
                break;
        }

        var rally = this;
        this.db.instructions.put(row).then(function () {rally.calculate();});

        //this.db.instructions.where('instr').equals(row.instr).first(function (instr) {
            //rally.instructions[instr.instr] = instr;
            //rally.ui.renderInstruction(instr);
        //});
    },

    sortedKeys: function() {
        return Object.keys(this.instructions).map(function(v) { return Number.parseFloat(v); }).sort(function (a,b) {return a-b});
    },

    deleteInstruction: function(instr) {
        //delete this.instructions[instr.instr];
        var rally = this;
        this.db.instructions.where('instr').equals(instr).delete().then(function () {rally.calculate();});
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


function RallyInstruction() {
}
RallyInstruction.prototype = {
    props: {
        instr: 0,
        raw_mlg: 1,
        raw_d_mlg: 2,
        mlg: 3,
        d_mlg: 4,
        cas: 5,
        delay: 6,
        tod: 7,
        time: 8,
        d_time: 9,   
    },

    labels: [
        'Instr',
        'Raw Mlg',
        'Raw &Delta;Mlg',
        'Mlg',
        '&Delta;Mlg',
        'CAS',
        'Delay',
        'TOD',
        'Time',
        '&Delta;Time',
    ],

    values: [],

    calculated: [],

    prev: null,

    next: null,

    save: function() {
        console.log("TODO: Save RallyInstruction");
    },

    formatMilleage: function(val, places) {
        return Math.round(val * 1000) / 1000;
    },

    formatTime: function(seconds) {
        var d = new Date();
        d.setTime(Date.now());
        d.setHours(0);
        d.setMinutes(0);
        d.setSeconds(0);
        d.setMilliseconds(0);
        d.setTime(d.getTime() + seconds * 1000.0);
        return d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds();
    },

    formatDeltaTime: function(seconds) {
        var minutes = ~~(seconds / 60);
        return minutes + ':' + Math.round(seconds * 100) / 100;
    },
    
    calculate: function(rally, prev) {
        //[ 'instr', 'raw_mlg', 'cas', 'delay', 'mlg', 'abs_time', 'is_omp', 'is_cp' ]

        this.calculated = Array();
        for (var p in this.props) {
            this.calculated[this.props[p]] = true;
        }
        this.calculated[0] = false;
        this.calculated[1] = false;

        if (prev) {
            this.raw_d_mlg = this.raw_mlg - prev.raw_mlg;
        } else {
            this.raw_d_mlg = 0;
        }
        this.d_mlg = rally.adjustMilleage(this.raw_d_mlg);

        if (this.mlg == null) {
            if (prev) {
                this.mlg = prev.mlg + this.d_mlg;
            } else {
                this.mlg = 0;
            }
        } else {
            this.calculated[this.props.mlg] = false;
        }

        if (this.cas == null) {
            if (prev) {
                this.cas = prev.cas;
            } else {
                this.cas = 0;
            }
        } else {
            this.calculated[this.props.cas] = false;
        }

        if (this.delay == null) {
            this.delay = 0;
        } else {
            this.calculated[this.props.delay] = false;
        }

        if (prev) {
            this.d_time = (this.raw_d_mlg * 3600) / prev.cas + this.delay;
        } else {
            this.d_time = 0;
        }

        if (this.abs_time == null) {
            if (prev) {
                this.abs_time = prev.abs_time + this.d_time;
            } else {
                this.abs_time = 0;
            }
        } else {
            this.calculated[this.props.abs_time] = false;
        }

        if (this.tod == null) {
            if (prev) {
                this.tod = prev.tod + this.d_time;
            } else {
                this.tod = 0;
            }
        } else {
            this.calculated[this.props.tod] = false;
        }

        this.values = [
            this.instr,
            this.formatMilleage(this.raw_mlg),
            this.formatMilleage(this.raw_d_mlg),
            this.formatMilleage(this.mlg),
            this.formatMilleage(this.d_mlg),
            this.cas,
            this.delay || '', // Empty cell when delay == 0
            this.formatTime(this.tod),
            this.formatDeltaTime(this.abs_time),
            this.formatDeltaTime(this.d_time, 0),
        ];

    },
};
