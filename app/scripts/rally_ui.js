(function () {
'use strict';

window.RallyUI = function(rally) {
    this.rally = rally;
    var ui = this;

    $('#add-instruction').on('click', function (e) {
        ui.rally.addNextInstruction().then(function (row) {
            ui.selectInstruction(row);
        });
    });

    $('#edit-instruction').on('click', function (e) {
        ui.editMode(!ui.editState);
    });

    $('#reset-instructions').on('click', function (e) {
        ui.rally.reset();
    });

    $('#toggle-timer').on('click', function (e) {
        ui.toggleTimer();
    });

    $('#export').on('click', function (e) {
        ui.export();
    });

    var import_input = $('#import-input');
    $('#import').on('click', function (e) {
        import_input.trigger('click');
    });
    FileAPI.event.on(import_input[0], 'change', function (e) {
        var files = FileAPI.getFiles(e);
        var reader = new FileReader();
        reader.onload = function(e) {
            var rally_json = e.target.result;
            ui.import(rally_json);
        }
        reader.readAsText(files[0]);
    });

    $('#hideshow div.panel-heading').on('click', function (e) {
        $('#hideshow ul').collapse('toggle');
    });

    $(document).on('keydown', function (e) {
        ui.handleKeyDownGlobal(e);
    });

    this.editBox('#edit-rally-speed', rally.rallySpeed);
    this.editBox('#edit-odom-factor', rally.odomFactor);
    this.editBox('#edit-clock-adj', rally.clockAdj)
        .on('focus', function(e) {
            ui.setTimerInterval(10);
        })
        .on('blur', function(e) {
            ui.setTimerInterval(100);
        });
    this.editCheckbox('#edit-time-seconds', rally.timeSeconds)
        .on('change', function() {
            ui.updateTimeFormats();
            ui.renderInstructions();
        });

    ui.updateTimeFormats();

    ui.createTimer();

    ui.editMode(false);

    ui.renderInstructionsHeader();

    ui.showColumn();
};

RallyUI.prototype = {
    checkVal: function(val) {
        if (typeof val == 'undefined' || val === null) {
            return 'ERR';
        }
        return val;
    },

    editState: false,

    selected: null,

    columnState: {},

    timerBody: null,

    timerInterval: null,

    laps: null,

    modalActive: false,

    menu_hidden_columns: {},

    export: function() {
        var ui = this;
        return ui.rally.serialize().then(function (rally_obj) {
            var blob = new Blob([JSON.stringify(rally_obj)], {type: "text/plain;charset=utf-8"});
            saveAs(blob, "RallyComputer.json");
        });
    },

    import: function(rally_json) {
        var ui = this;
        var rally_obj = JSON.parse(rally_json);
        var ui_config_keys = Object.keys(ui);
        var rally_config_keys = Object.keys(ui.rally);

        ui.rally.deserialize(rally_obj);

    },

    showColumn: function(name, show) {
        var ui = this;
        var setVisible = function(name, show) {
            if (show) {
                $('th[data-col=\''+name+'\']').show();
                $('td[data-col=\''+name+'\']').show();
            } else {
                $('th[data-col=\''+name+'\']').hide();
                $('td[data-col=\''+name+'\']').hide();
            }
            $('label[data-col=\''+name+'\'] input').prop('checked', show);
            ui.menu_hidden_columns[name].visible = !show;
        };
        if (name) {
            if (name == 'instr') {
                return;
            }
            setVisible(name, show);
            ui.columnState[name] = show;
            ui.rally.setConfig('column_state', JSON.stringify(this.columnState));
        } else {
            var columnState = ui.rally.getConfig('column_state');
            try {
                columnState = JSON.parse(columnState);
            } catch (e) { /* do nothing */ }
            if (!columnState) {
                columnState = {
                    'raw_mlg': false,
                    'raw_d_mlg': false,
                    'time': false,
                };
            }
            RallyInstruction.prototype.column_defs_display_order.forEach(function (def) {
                if (!columnState.hasOwnProperty(def.name)) {
                    columnState[def.name] = true;
                }
                setVisible(def.name, columnState[def.name]);
            });
            ui.columnState = columnState;
        }

        // Force table layout to update
        $('#instructions').trigger( "resize" );
    },

    renderInstructionsHeader: function() {
        var table = $('#instructions');
        var thead = table.children('thead');
        var hideshow_body = $('#hideshow div.panel-body');
        var ui = this;

        thead.children().remove();
        var hideshow = $('#hideshow ul');
        hideshow.children().remove();

        var tr = $('<tr />');
        RallyInstruction.prototype.column_defs_display_order.forEach(function (col) {
            var th = $('<th />').attr('data-col', col.name);
            th.addClass('instruction-column');
            th.html(col.label);
            if (col.description) {
                th.attr('title', col.description);
            }

            th.on('dblclick', function (e) {
                ui.showColumn(col.name, false);
            });
            tr.append(th);

            var input = $('<input type=checkbox checked/>');
            input.on('change', function (e) {
                ui.showColumn(col.name, e.target.checked);
            });

            var label = ' <span class="col_label">' + col.label + '</span>';
            if (col.description) {
                label += ': <span class="col_description">' + col.description + '</span>';
            }
            hideshow.append($('<label class="list-group-item" />').attr('data-col', col.name).append(input).append(label));

            ui.columnState[col.name] = true;

            ui.menu_hidden_columns[col.name] = {
                name: col.label,
            };
        });

        thead.append(tr);

        $.contextMenu({
            selector: '.instruction-column',
            callback: function (key, opt) {
                console.log(key);
                console.log(opt);
                var name = key;
                ui.showColumn(name, true);
                return true;
            },
            build: function () {
                var items = {
                    hide: {
                        name: 'Hide',
                        callback: function (key, opt) {
                            var name = this.attr('data-col');
                            ui.showColumn(name, false);
                            return true;
                        },
                    },
                    show: {
                        name: 'Show',
                        items: ui.menu_hidden_columns,
                    },
                };
                return {items: items};
            },
        });

        var instrFromRow = function(element) {
            return Number.parseFloat(element.attr('data-row'));
        };

        $.contextMenu({
            selector: 'tr td',
            items: {
                insert_before: {
                    name: 'Insert before',
                    callback: function (key, opt) {
                        ui.insertInstruction(-0.5);
                        return true;
                    },
                },
                insert_after: {
                    name: 'Insert after',
                    callback: function (key, opt) {
                        ui.insertInstruction(0.5);
                        return true;
                    },
                },

                separator1: { "type": "cm_seperator" },

                delete: {
                    name: 'Delete',
                    callback: function (key, opt) {
                        var tr = this.closest('tr');
                        var instr = instrFromRow(tr);
                        ui.rally.deleteInstruction(ui.rally.instruction(instr));
                        return true;
                    },
                },
            },
        });

        // Must be after contextMenu to prevent buggy item callbacks
        table.floatThead();
    },

    renderInstructions: function() {
        var tbody = $('#instructions').children('tbody');
        tbody.children().remove();
        var ui = this;
        ui.rally.instructions.forEach(function (instr) {
            ui.renderInstruction(instr);
        });
        $('#instructions').trigger( "resize" );
    },

    renderInstruction: function(instr) {
        if (instr === null) {
            return;
        }
        var tbody = $('#instructions').children('tbody');
        var ui = this;
        var tr = $('<tr />').attr('data-row', instr.instr).attr('tabindex', 0);

        instr.columns.forEach(function (col) {
            var td = $('<td />').attr('data-col', col.name);
            var calculated = !col.isSet();
            if (!calculated) {
                td.addClass('notcalc');
            }
            var pretty_val = col.value;
            if (col.name == 'delay' || col.name == 'err_time') {
                if (pretty_val === 0) {
                    pretty_val = '';
                }
            } else if (col.name == 'notes') {
                td.removeClass('notcalc');
            } else if (typeof pretty_val == 'number') {
                if (col.name == 'instr') {
                    pretty_val = pretty_val.toFixed(1);
                } else if (col.name == 'tod') {
                    pretty_val = ui.formatAbsTime(pretty_val);
                } else if (col.name == 'd_time') {
                    pretty_val = ui.formatRelTime(pretty_val);
                } else if (col.name != 'cas') {
                    pretty_val = pretty_val.toFixed(3);
                }
            }
            if (ui.editState && ui.isSelected(instr.instr) && !col.read_only) {
                var input = $('<input />');
                input.attr('type', 'text');
                input.attr('size', 5);
                if (calculated) {
                    input.attr('placeholder', pretty_val);
                    input.attr('defaultValue', '');
                } else {
                    input.val(pretty_val);
                    input.attr('defaultValue', pretty_val);
                }
                input.on('keydown', function (e) {
                    ui.handleKeyDownInput(e, instr);
                });
                input.on('blur', function (e) {
                    var val = null;
                    if (input.val().length > 0) {
                        val = input.val();
                    }
                    if (val != col.stored_value) {
                        try {
                            ui.rally.setValue(instr, col, val);
                        } catch (err) {
                            ui.alertDanger('Exception', err.message);
                            input.val(input.attr('defaultValue'));
                        }
                    }
                });
                td.append(input);
                td.addClass('edit');
            } else {
                td.html(pretty_val);
            }
            if (col.name == 'd_mlg') {
                if (pretty_val <= 0.15 && pretty_val > 0) {
                    td.addClass('danger');
                }
            } else if (col.name == 'cas') {
                if (pretty_val > 0 && pretty_val != ui.rally.rallySpeed()) {
                    td.addClass('warning');
                }
            }
            tr.append(td);

            if (!ui.columnState[col.name])
                td.hide();
        });

        tr.on('click', function (e) {
            if (!ui.isSelected(instr.instr)) {
                ui.selectInstruction(instr.instr, {row: instr.instr, col: $(e.target).attr('data-col')});
            }
        });

        tr.on('focus', function (e) {
            if (!ui.isSelected(instr.instr)) {
                ui.selectInstruction(instr.instr);
            }
        });

        tr.on('dblclick', function (e) {
            if (!ui.editState) {
                ui.editMode(true, {row: instr.instr, col: $(e.target).attr('data-col')});
            }
        });

        tr.on('keydown', function (e) {
            ui.handleKeyDownRow(e, instr);
        });

        var old_tr = tbody.children('tr[data-row=\''+instr.instr+'\']');
        if (old_tr.length > 0) {
            tr.insertBefore(old_tr);
            old_tr.remove();
        } else {
            tbody.append(tr);
        }

        if (ui.isSelected(instr.instr)) {
            tr.addClass('active');
            if (ui.editState) {
                tr.children('td[data-col='+ui.selected.col+']').children('input').focus().select();
            } else {
                tr.focus();
            }
        }
    },

    handleKeyDownInput: function(e, instr) {
        var i;
        var count;
        var ui = this;
        var input = $(e.target);
        var index = input.closest('td').attr('data-col');
        var handled = true;
        if (ui.modalActive) {
            return;
        }
        switch(e.keyCode) {
            case 33: // page up
                i = instr;
                for (count = 5; count > 0; count--) {
                    if (i.prev) {
                        i = i.prev;
                    }
                }
                if (i != instr) {
                    input.trigger('blur');
                    ui.selectInstruction(i.instr, {row: i.instr, col: index});
                }
                break;
            case 34: // page down
                i = instr;
                for (count = 5; count > 0; count--) {
                    if (i.next) {
                        i = i.next;
                    }
                }
                if (i != instr) {
                    input.trigger('blur');
                    ui.selectInstruction(i.instr, {row: i.instr, col: index});
                }
                break;
            case 38: // up
                if (instr.prev) {
                    input.trigger('blur');
                    ui.selectInstruction(instr.prev.instr, {row: instr.prev.instr, col: index});
                }
                break;
            case 13: // enter
            case 40: // down
                var next = instr.next;
                input.trigger('blur');
                if (next) {
                    ui.selectInstruction(instr.next.instr, {row: instr.next.instr, col: index});
                } else {
                    ui.rally.addNextInstruction().then(function (row) {
                        ui.selectInstruction(row, {row: row, col: index});
                    });
                }
                break;
            case 27: // escape
                ui.editMode(false);
                break;
            case 46: // delete
                if (e.shiftKey) {
                    if (instr.next) {
                        ui.selectInstruction(instr.next.instr, {row: instr.next.instr, col: index});
                    } else if (instr.prev) {
                        ui.selectInstruction(instr.prev.instr, {row: instr.prev.instr, col: index});
                    }
                    ui.rally.deleteInstruction(instr.id);
                } else {
                    handled = false;
                }
                break;
            default:
                handled = false;
                break;
        }
        if (handled) {
            e.stopPropagation();
            e.preventDefault();
        }
    },

    handleKeyDownRow: function(e, instr) {
        var i;
        var count;
        var ui = this;
        var handled = true;
        if (ui.modalActive) {
            return;
        }
        switch(e.keyCode) {
            case 33: // page up
                i = instr;
                for (count = 5; count > 0; count--) {
                    if (i.prev) {
                        i = i.prev;
                    }
                }
                if (i != instr) {
                    ui.selectInstruction(i.instr, {row: i.instr, col: index});
                }
                break;
            case 34: // page down
                i = instr;
                for (count = 5; count > 0; count--) {
                    if (i.next) {
                        i = i.next;
                    }
                }
                if (i != instr) {
                    ui.selectInstruction(i.instr, {row: i.instr, col: index});
                }
                break;
            case 38: // up
                if (instr.prev) {
                    ui.selectInstruction(instr.prev.instr);
                }
                break;
            case 40: // down
                var next = instr.next;
                if (instr.next) {
                    ui.selectInstruction(instr.next.instr);
                }
                break;
            default:
                handled = false;
                break;
        }
        if (handled) {
            e.stopPropagation();
            e.preventDefault();
        }
    },

    handleKeyDownGlobal: function(e, instr) {
        var ui = this;
        var handled = false;
        if (ui.modalActive) {
            return;
        }
        try {
            switch(e.keyCode) {
                case 113: // f2
                    ui.editMode(!ui.editState);
                    break;
                case 76: // L
                    ui.timerLap();
                    break;
                case 67: // C
                    if (e.shiftKey) {
                        ui.timerResetLaps();
                    }
                    break;
                case 189: // DASH
                case 109: // KP_MINUS
                    ui.insertInstruction(e.shiftKey ? -1 : -0.5);
                    break;
                case 187: // EQUAL SIGN
                case 107: // KP_PLUS
                    ui.insertInstruction(e.shiftKey ? 1 : 0.5);
                    break;
                default:
                    handled = false;
                    break;
            }
        } catch (err) {
            ui.alertException(err);
        }
        if (handled) {
            e.stopPropagation();
            e.preventDefault();
        }
    },

    findRow: function(instr) {
        return $('tr[data-row=\''+instr+'\']');
    },

    findCell: function(instr, column) {
        return $('tr[data-row=\''+instr+'\']').children('td[data-col=\''+column+'\']');
    },

    isSelected: function(instr) {
        return (this.selected !== null && this.selected.row == instr);
    },

    selectInstruction: function (instr, target) {
        $('tr.active').removeClass('active');
        var old_selected = this.selected;
        instr = Number.parseFloat(instr);
        if (isNaN(instr)) {
            instr = null;
        }
        if (target) {
            target.row = Number.parseFloat(target.row);
            target.col = target.col || null;
        }
        if (old_selected !== null) {
            var old_tr = $('tr[data-row=\''+old_selected.row+'\']');
            old_tr.find('input').trigger('blur');
        }
        if (instr !== null) {
            if (target) {
                this.selected = target;
            } else {
                this.selected = {row: instr, col: 0};
            }
            this.renderInstruction(this.rally.instruction(instr));
            if (old_selected !== null) {
                this.renderInstruction(this.rally.instruction(old_selected.row));
            }
            var tr = $('tr[data-row=\''+instr+'\']');
            if (this.editState && target) {
                var td = this.findCell(target.row, target.col);
                var input = td.find('input');
                input.focus();
                input.select();
            }
            tr.addClass('active');
        }
    },

    editMode: function (state, target) {
        if (typeof state != 'undefined') {
            this.editState = state;
        }
        if (this.selected !== null) {
            this.renderInstruction(this.rally.instruction(this.selected.row));
            if (this.editState && target) {
                var tr = this.findRow(target.row);
                var td = this.findCell(target.row, target.col);
                var input = td.find('input');
                input.focus();
                input.select();
            }
        }
        var editButton = $('#edit-instruction');
        if (state) {
            editButton.addClass('active');
        } else {
            editButton.removeClass('active');
        }
    },

    editBox: function(input, prop) {
        var ui = this;
        input = $(input);
        prop = prop.bind(ui.rally);
        input.on('blur', function (e) {
            prop(input.val());
            ui.renderInstructions();
        });
        input.val(prop());
        return input;
    },

    editCheckbox: function(input, prop) {
        var ui = this;
        input = $(input);
        prop = prop.bind(ui.rally);
        input.on('change', function (e) {
            prop(input.is(':checked'));
            ui.renderInstructions();
        });
        input.prop('checked', prop());
        return input;
    },

    createTimer: function() {
        var ui = this;
        var container = $('body');
        var timerPanel = $('#timer-panel');
        this.timerBody = $('#timer-value');
        timerPanel.css('position', 'fixed');
        ui.ensureTimerVisible();
        timerPanel.draggable({
            handle: '.move-grip',
            containment: container,
            scroll: false,
            delay: 100,
            stop: function(e, jquery_ui) {
                ui.timerPosition(jquery_ui.position);
            },
        });
        var timer = null;
        timerPanel.on('mousedown', function() {
            timer = setTimeout(function() {
                timerPanel.addClass('ui-draggable-dragging');
            }, 100);
        });
        timerPanel.on('mouseup', function() {
            timerPanel.removeClass('ui-draggable-dragging');
            clearTimeout(timer);
        });
        this.setTimerInterval(100);

        this.laps = $('#timer-laps');
        $('#timer-lap').on('click', function() {
            ui.timerLap();
        });
        $('#timer-clear').on('click', function() {
            ui.timerResetLaps();
        });

        if (ui.rally.getConfig('timer_visible') == 'true') {
            timerPanel.show();
            $('#toggle-timer').addClass('active');
        } else {
            timerPanel.hide();
        }
    },

    setTimerInterval: function(interval) {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        if (interval > 0) {
            this.timerInterval = setInterval(this.updateTimer.bind(this), interval);
        }
    },

    updateTimer: function() {
        if (this.timerBody) {
            var old_val = this.timerBody.text();
            var val = this.formatTimer(this.rally.now());
            if (old_val != val) {
                this.timerBody.text(val);
            }
        }
    },

    timerPosition: function(val) {
        if (arguments.length > 0) {
            this.rally.setConfig('timer_position', JSON.stringify(val));
        }
        try {
            val = JSON.parse(this.rally.getConfig('timer_position'));
        } catch(e) {
            if (e.name == "SyntaxError") {
                val = null;
            } else {
                throw e;
            }
        }
        if (val === null) {
            val = {top: 0, left: 0};
        }
        return val;
    },

    updateTimeFormats: function() {
        if (this.rally.timeSeconds()) {
            this.formatTimer = function(val) { return moment(val).format('HH:mm:ss.S'); };
            this.formatAbsTime = function(val) { return moment(val).format('HH:mm:ss'); };
            this.formatRelTime = function(val) { return (val > 0 ? moment(val * 1000).format('m:ss') : '0:00'); };
        } else {
            var tenths = function(val, fmt) {
                var t = moment(val);
                var minutes = parseFloat(moment.duration({seconds: t.second(), milliseconds: t.milliseconds()}).asMinutes());
                var new_val = t.format(fmt) + String(minutes.toFixed(3)).substr(1);
                return new_val;
            };
            this.formatTimer = function(val) { return tenths(val, 'HH:mm'); };
            this.formatAbsTime = function(val) { return tenths(val, 'HH:mm'); };
            this.formatRelTime = function(val) { return (val > 0 ? tenths(val * 1000, 'm') : '0.000'); };
        }
    },

    timerLap: function() {
        var lap = this.rally.now();
        this.laps.append($('<li />').text(this.formatTimer(lap)));
        if (this.selected) {
            var instr = this.rally.instruction(this.selected.row);
            this.rally.setValue(instr, 'tod', this.formatAbsTime(lap));
        }
    },

    timerResetLaps: function() {
        this.laps.children().remove();
    },

    ensureTimerVisible: function() {
        var ui = this;
        var container = $('body');
        var timerPanel = $('#timer-panel');
        var position = ui.timerPosition();
        if (position.left + timerPanel.width() > container.width()) {
            position.left = container.width() - timerPanel.width();
        }
        if (position.top + timerPanel.height() > container.height()) {
            position.top = container.height() - timerPanel.height();
        }
        ui.timerPosition(position);
        timerPanel.css(position);
    },

    toggleTimer: function() {
        var button = $('#toggle-timer');
        var timerPanel = $('#timer-panel');
        var ui = this;
        var visible = timerPanel.is(':visible');
        if (!visible) {
            timerPanel.show();
            ui.ensureTimerVisible();
            button.addClass('active');
            ui.setTimerInterval(100);
        } else {
            button.removeClass('active');
            ui.setTimerInterval(0);
            timerPanel.hide();
        }
        ui.rally.setConfig('timer_visible', JSON.stringify(!visible));
    },

    alertDanger: function(title, message) {
        var ui = this;
        var dialog = $('#alert');
        var header = dialog.find('.modal-header');
        header.addClass('alert-danger');
        dialog.find('.modal-title').text(title);
        dialog.find('.modal-body').text(message);
        dialog.on('hidden.bs.modal', function(e) {
            header.removeClass('alert-danger');
            dialog.unbind('hidden.bs.modal');
            ui.modalActive = false;
        });
        ui.modalActive = true;
        dialog.modal();
    },

    alertException: function(e) {
        this.alertDanger('Exception', e.message);
    },

    insertInstruction: function(relative) {
        var ui = this;
        if (ui.selected) {
            var instruction = ui.rally.instruction(ui.selected.row);
            ui.rally.addInstruction(instruction.instr.value + relative).then(function (instruction) {
                ui.selectInstruction(instruction);
            });
        }
    },
};

}());