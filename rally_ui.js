function RallyUI(rally) {
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

    $('#instructions').on('keydown', function (e) {
        console.log('TODO: For keys relating to cells, determine current cell and invoke cell keydown; others handle directly');
    });

    var rally_speed = $('#edit-rally-speed');
    rally_speed.on('blur', function (e) {
        rally.rallySpeed($(this).val());
    });
    rally_speed.val(rally.rallySpeed());

}

RallyUI.prototype = {
    checkVal: function(val) {
        if (typeof val == 'undefined' || val == null) {
            return 'ERR';
        }
        return val;
    },

    editState: false,

    selectedInstruction: null,

    columnState: [],

    showColumn(index, show) {
        if (show) {
            $('th[data-col=\''+index+'\']').show();
            $('td[data-col=\''+index+'\']').show();
        } else {
            $('th[data-col=\''+index+'\']').hide();
            $('td[data-col=\''+index+'\']').hide();
        }
        $('label[data-col=\''+index+'\'] input').prop('checked', show);
        this.columnState[index] = show;

        // Force table layout to update
        $('#instructions').trigger( "resize" );
    },

    renderInstructionsHeader: function() {
        var table = $('#instructions');
        var thead = table.children('thead');
        var hideshow = $('#hideshow');
        var ui = this;

        thead.children().remove();
        hideshow.children().remove();

        var tr = $('<tr />');
        RallyInstruction.prototype.columnDefs.forEach(function (col) {
            var th = $('<th />').attr('data-col', col.index);
            th.html(col.label);

            th.on('dblclick', function (e) {
                ui.showColumn(col.index, false);
            });
            tr.append(th);

            var input = $('<input type=checkbox checked/>');
            input.on('change', function (e) {
                ui.showColumn(col.index, e.target.checked);
            });

            hideshow.append($('<label />').attr('data-col', col.index).append(input).append(col.label));

            ui.columnState[col.index] = true;
        });

        thead.append(tr);

        $.contextMenu({
            selector: 'thead th', 
            items: {
                hide: {
                    name: 'Hide',
                    callback: function (key, opt) {
                        var index = this.attr('data-col');
                        ui.showColumn(index, false);
                        return true;
                    },
                },
            },
        });

        var instrFromRow = function(element) {
            return Number.parseFloat(element.attr('data-row'));
        }
        $.contextMenu({
            selector: 'tr td', 
            items: {
                insert_before: {
                    name: 'Insert before',
                    callback: function (key, opt) {
                        var tr = this.closest('tr');
                        var instr = instrFromRow(tr);
                        ui.rally.addInstruction(instr - 0.5);
                        return true;
                    },
                },
                insert_after: {
                    name: 'Insert after',
                    callback: function (key, opt) {
                        var tr = this.closest('tr');
                        var instr = instrFromRow(tr);
                        ui.rally.addInstruction(instr + 0.5);
                        return true;
                    },
                },

                separator1: { "type": "cm_seperator" },

                delete: {
                    name: 'Delete',
                    callback: function (key, opt) {
                        var tr = this.closest('tr');
                        var instr = instrFromRow(tr);
                        ui.rally.deleteInstruction(instr);
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
        var instructions = ui.rally.instructions;
        this.rally.sortedKeys().forEach(function (i) {
            ui.renderInstruction(instructions[i]);
        });
        $('#instructions').trigger( "resize" );
    },

    renderInstruction: function(instr) {
        var tbody = $('#instructions').children('tbody');
        var ui = this;
        var tr = $('<tr />').attr('data-row', instr.instr);

        instr.columns.forEach(function (col, index) {
            var td = $('<td />').attr('data-col', index);
            var calculated = col.isCalculated();
            if (!calculated) {
                td.addClass('notcalc');
            }
            if (ui.editState && ui.selectedInstruction == instr.instr && col.is_db) {
                var input = $('<input />');
                input.attr('type', 'text');
                input.attr('size', 5);
                if (calculated) {
                    input.attr('placeholder', col.display_value);
                } else {
                    input.val(col.calculated_value);
                }
                input.on('keydown', function (e) {
                    ui.handleKeyDown(e, instr);
                });
                input.on('blur', function (e) {
                    var val = null;
                    if (input.val().length > 0) {
                        val = input.val();
                    }
                    if (val != col.value) {
                        ui.rally.setValue(instr.instr, col.index, val);
                    }
                });
                td.append(input);
                td.addClass('edit');
            } else {
                var val = col.toString();
                if (col.name == 'delay') {
                    if (val == 0) {
                        val = '';
                    }
                } else if (typeof val == 'number') {
                    if (col.name == 'instr') {
                        val = val.toFixed(1);
                    } else if (col.name == 'd_time') {
                        val = moment('0:0', 'm:s').add(val, 'seconds').format('m:ss');
                    } else if (col.name != 'cas') {
                        val = val.toFixed(3);
                    }

                }
                td.html(val);
            }
            if (col.name == 'd_mlg') {
                if (val <= 0.15 && val > 0) {
                    td.addClass('danger');
                }
            } else if (col.name == 'cas') {
                if (val > 0 && val != rally.rallySpeed()) {
                    td.addClass('warning');
                }
            }
            tr.append(td);

            if (!ui.columnState[index])
                td.hide();
        });
        if (ui.selectedInstruction == instr.instr) {
            tr.addClass('active');
        }

        tr.on('click', function (e) {
            if (ui.selectedInstruction != instr.instr) {
                ui.selectInstruction(instr.instr, {row: instr.instr, col: $(e.target).attr('data-col')});
            }
        });

        tr.on('dblclick', function (e) {
            if (!ui.editState) {
                ui.editMode(true, {row: instr.instr, col: $(e.target).attr('data-col')});
            }
        });

        var old_tr = tbody.children('tr[data-row=\''+instr.instr+'\']');
        if (old_tr.length > 0) {
            tr.insertBefore(old_tr);
            old_tr.remove();
        } else {
            tbody.append(tr);
        }
    },

    handleKeyDown(e, instr) {
        var ui = this;
        var input = $(e.target);
        var index = Number.parseFloat(input.closest('td').attr('data-col'));
        var handled = true;
        switch(e.keyCode) {
            case 33: // page up
                var i = instr;
                var count = 5;
                for (var count = 5; count > 0; count--) {
                    if (i.prev) {
                        i = i.prev;
                    }
                }
                if (i != instr) {
                    ui.selectInstruction(i.instr, {row: i.instr, col: index});
                }
                break;
            case 34: // page down
                var i = instr;
                var count = 5;
                for (var count = 5; count > 0; count--) {
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
                    ui.selectInstruction(instr.prev.instr, {row: instr.prev.instr, col: index});
                }
                break;
            case 40: // down
                if (instr.next) {
                    ui.selectInstruction(instr.next.instr, {row: instr.next.instr, col: index});
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
                    ui.editMode(false);
                    ui.rally.deleteInstruction(instr.instr);
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

    findRow: function(instr) {
        return $('tr[data-row=\''+instr+'\']');
    },

    findCell: function(instr, column) {
        return $('tr[data-row=\''+instr+'\']').children('td[data-col=\''+column+'\']');
    },

    selectInstruction: function (instr, target) {
        $('tr.active').removeClass('active');
        var old_instr = this.selectedInstruction;
        instr = Number.parseFloat(instr);
        if (isNaN(instr)) {
            instr = null;
        }
        if (target) {
            target.row = Number.parseFloat(target.row);
            target.col = Number.parseInt(target.col);
        }
        if (old_instr != null) {
            var old_tr = $('tr[data-row=\''+old_instr+'\']');
            old_tr.find('input').trigger('blur');
        }
        if (instr != null) {
            this.selectedInstruction = instr;
            this.renderInstruction(this.rally.instructions[instr]);
            if (old_instr != null) {
                this.renderInstruction(this.rally.instructions[old_instr]);
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
        if (this.selectedInstruction != null) {
            this.renderInstruction(this.rally.instructions[this.selectedInstruction]);
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
};
