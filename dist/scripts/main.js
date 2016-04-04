"use strict";!function(){window.RallyUI=function(t){this.rally=t;var e=this;$("#add-instruction").on("click",function(t){e.rally.addNextInstruction().then(function(t){e.selectInstruction(t)})}),$("#edit-instruction").on("click",function(t){e.editMode(!e.editState)}),$("#reset-instructions").on("click",function(t){e.rally.reset()}),$(document).on("keydown",function(t){e.handleKeyDownGlobal(t)}),this.editBox("#edit-rally-speed",t.rallySpeed),this.editBox("#edit-odom-factor",t.odomFactor),this.editBox("#edit-clock-adj",t.clockAdj).on("focus",function(t){e.setTimerInterval(10)}).on("blur",function(t){e.setTimerInterval(100)}),this.editCheckbox("#edit-time-seconds",t.timeSeconds).on("change",function(){e.updateTimeFormats(),e.renderInstructions()}),e.updateTimeFormats(),e.createTimer()},RallyUI.prototype={checkVal:function(t){return"undefined"==typeof t||null===t?"ERR":t},editState:!1,selected:null,columnState:[],timerBody:null,timerInterval:null,laps:null,modalActive:!1,showColumn:function(t,e){e?($("th[data-col='"+t+"']").show(),$("td[data-col='"+t+"']").show()):($("th[data-col='"+t+"']").hide(),$("td[data-col='"+t+"']").hide()),$("label[data-col='"+t+"'] input").prop("checked",e),this.columnState[t]=e,$("#instructions").trigger("resize")},renderInstructionsHeader:function(){var t=$("#instructions"),e=t.children("thead"),n=$("#hideshow"),i=this;e.children().remove(),n.children().remove();var r=$("<tr />");RallyInstruction.prototype.columnDefs.forEach(function(t){var e=$("<th />").attr("data-col",t.index);e.html(t.label),e.on("dblclick",function(e){i.showColumn(t.index,!1)}),r.append(e);var a=$("<input type=checkbox checked/>");a.on("change",function(e){i.showColumn(t.index,e.target.checked)}),n.append($("<label />").attr("data-col",t.index).append(a).append(t.label)),i.columnState[t.index]=!0}),e.append(r),$.contextMenu({selector:"thead th",items:{hide:{name:"Hide",callback:function(t,e){var n=this.attr("data-col");return i.showColumn(n,!1),!0}}}});var a=function(t){return Number.parseFloat(t.attr("data-row"))};$.contextMenu({selector:"tr td",items:{insert_before:{name:"Insert before",callback:function(t,e){return i.insertInstruction(-.5),!0}},insert_after:{name:"Insert after",callback:function(t,e){return i.insertInstruction(.5),!0}},separator1:{type:"cm_seperator"},"delete":{name:"Delete",callback:function(t,e){var n=this.closest("tr"),r=a(n);return i.rally.deleteInstruction(i.rally.instruction(r).id),!0}}}}),t.floatThead()},renderInstructions:function(){var t=$("#instructions").children("tbody");t.children().remove();var e=this;e.rally.instructions.forEach(function(t){e.renderInstruction(t)}),$("#instructions").trigger("resize")},renderInstruction:function(t){if(null!==t){var e=$("#instructions").children("tbody"),n=this,i=$("<tr />").attr("data-row",t.instr).attr("tabindex",0);t.columns.forEach(function(e,r){var a=$("<td />").attr("data-col",r),o=e.isCalculated();o||a.addClass("notcalc");var l=e.toString();if("delay"==e.name?0===l&&(l=""):"number"==typeof l&&("instr"==e.name?l=l.toFixed(1):"tod"==e.name?l=n.formatAbsTime(l):"d_time"==e.name?l=n.formatRelTime(l):"cas"!=e.name&&(l=l.toFixed(3))),n.editState&&n.isSelected(t.instr)&&e.is_db){var s=$("<input />");s.attr("type","text"),s.attr("size",5),o?(s.attr("placeholder",l),s.attr("defaultValue","")):(s.val(l),s.attr("defaultValue",l)),s.on("keydown",function(e){n.handleKeyDownInput(e,t)}),s.on("blur",function(i){var r=null;if(s.val().length>0&&(r=s.val()),r!=e.value)try{n.rally.setValue(t.id,e.index,r)}catch(a){n.alertDanger("Exception",a.message),s.val(s.attr("defaultValue"))}}),a.append(s),a.addClass("edit")}else a.html(l);"d_mlg"==e.name?.15>=l&&l>0&&a.addClass("danger"):"cas"==e.name&&l>0&&l!=n.rally.rallySpeed()&&a.addClass("warning"),i.append(a),n.columnState[r]||a.hide()}),i.on("click",function(e){n.isSelected(t.instr)||n.selectInstruction(t.instr,{row:t.instr,col:$(e.target).attr("data-col")})}),i.on("focus",function(e){n.isSelected(t.instr)||n.selectInstruction(t.instr)}),i.on("dblclick",function(e){n.editState||n.editMode(!0,{row:t.instr,col:$(e.target).attr("data-col")})}),i.on("keydown",function(e){n.handleKeyDownRow(e,t)});var r=e.children("tr[data-row='"+t.instr+"']");r.length>0?(i.insertBefore(r),r.remove()):e.append(i),n.isSelected(t.instr)&&(i.addClass("active"),n.editState?i.children("td[data-col="+n.selected.col+"]").children("input").focus().select():i.focus())}},handleKeyDownInput:function(t,e){var n,i,r=this,a=$(t.target),o=Number.parseFloat(a.closest("td").attr("data-col")),l=!0;if(!r.modalActive){switch(t.keyCode){case 33:for(n=e,i=5;i>0;i--)n.prev&&(n=n.prev);n!=e&&(a.trigger("blur"),r.selectInstruction(n.instr,{row:n.instr,col:o}));break;case 34:for(n=e,i=5;i>0;i--)n.next&&(n=n.next);n!=e&&(a.trigger("blur"),r.selectInstruction(n.instr,{row:n.instr,col:o}));break;case 38:e.prev&&(a.trigger("blur"),r.selectInstruction(e.prev.instr,{row:e.prev.instr,col:o}));break;case 13:case 40:var s=e.next;a.trigger("blur"),s?r.selectInstruction(e.next.instr,{row:e.next.instr,col:o}):r.rally.addNextInstruction().then(function(t){r.selectInstruction(t,{row:t,col:o})});break;case 27:r.editMode(!1);break;case 46:t.shiftKey?(e.next?r.selectInstruction(e.next.instr,{row:e.next.instr,col:o}):e.prev&&r.selectInstruction(e.prev.instr,{row:e.prev.instr,col:o}),r.rally.deleteInstruction(e.id)):l=!1;break;default:l=!1}l&&(t.stopPropagation(),t.preventDefault())}},handleKeyDownRow:function(t,e){var n,i,r=this,a=!0;if(!r.modalActive){switch(t.keyCode){case 33:for(n=e,i=5;i>0;i--)n.prev&&(n=n.prev);n!=e&&r.selectInstruction(n.instr,{row:n.instr,col:index});break;case 34:for(n=e,i=5;i>0;i--)n.next&&(n=n.next);n!=e&&r.selectInstruction(n.instr,{row:n.instr,col:index});break;case 38:e.prev&&r.selectInstruction(e.prev.instr);break;case 40:e.next;e.next&&r.selectInstruction(e.next.instr);break;default:a=!1}a&&(t.stopPropagation(),t.preventDefault())}},handleKeyDownGlobal:function(t,e){var n=this,i=!1;if(!n.modalActive){try{switch(t.keyCode){case 113:n.editMode(!n.editState);break;case 76:n.timerLap();break;case 67:t.shiftKey&&n.timerResetLaps();break;case 109:n.insertInstruction(t.shiftKey?-1:-.5);break;case 107:n.insertInstruction(t.shiftKey?1:.5);break;default:i=!1}}catch(r){n.alertException(r)}i&&(t.stopPropagation(),t.preventDefault())}},findRow:function(t){return $("tr[data-row='"+t+"']")},findCell:function(t,e){return $("tr[data-row='"+t+"']").children("td[data-col='"+e+"']")},isSelected:function(t){return null!==this.selected&&this.selected.row==t},selectInstruction:function(t,e){$("tr.active").removeClass("active");var n=this.selected;if(t=Number.parseFloat(t),isNaN(t)&&(t=null),e&&(e.row=Number.parseFloat(e.row),e.col=Number.parseInt(e.col)),null!==n){var i=$("tr[data-row='"+n.row+"']");i.find("input").trigger("blur")}if(null!==t){e?this.selected=e:this.selected={row:t,col:0},this.renderInstruction(this.rally.instruction(t)),null!==n&&this.renderInstruction(this.rally.instruction(n.row));var r=$("tr[data-row='"+t+"']");if(this.editState&&e){var a=this.findCell(e.row,e.col),o=a.find("input");o.focus(),o.select()}r.addClass("active")}},editMode:function(t,e){if("undefined"!=typeof t&&(this.editState=t),null!==this.selected&&(this.renderInstruction(this.rally.instruction(this.selected.row)),this.editState&&e)){var n=(this.findRow(e.row),this.findCell(e.row,e.col)),i=n.find("input");i.focus(),i.select()}var r=$("#edit-instruction");t?r.addClass("active"):r.removeClass("active")},editBox:function(t,e){var n=this;return t=$(t),e=e.bind(n.rally),t.on("blur",function(i){e(t.val()),n.renderInstructions()}),t.val(e()),t},editCheckbox:function(t,e){var n=this;return t=$(t),e=e.bind(n.rally),t.on("change",function(i){e(t.is(":checked")),n.renderInstructions()}),t.prop("checked",e()),t},createTimer:function(){var t=this,e=$("body"),n=$("#timer-panel");this.timerBody=$("#timer-value"),n.css("position","fixed");var i=t.timerPosition();i.left+n.width()>e.width()&&(i.left=e.width()-n.width()),i.top+n.height()>e.height()&&(i.top=e.height()-n.height()),t.timerPosition(i),n.css(i),n.draggable({handle:".move-grip",containment:e,scroll:!1,delay:100,stop:function(e,n){t.timerPosition(n.position)}});var r=null;n.on("mousedown",function(){r=setTimeout(function(){n.addClass("ui-draggable-dragging")},100)}),n.on("mouseup",function(){n.removeClass("ui-draggable-dragging"),clearTimeout(r)}),this.setTimerInterval(100),this.laps=$("#timer-laps"),$("#timer-lap").on("click",function(){t.timerLap()}),$("#timer-clear").on("click",function(){t.timerResetLaps()}),n.addClass("in")},setTimerInterval:function(t){this.timerInterval&&clearInterval(this.timerInterval),this.timerInterval=setInterval(this.updateTimer.bind(this),t)},updateTimer:function(){if(this.timerBody){var t=this.timerBody.text(),e=this.formatTimer(this.rally.now());t!=e&&this.timerBody.text(e)}},timerPosition:function(t){arguments.length>0&&this.rally.setConfig("timer_position",JSON.stringify(t));try{t=JSON.parse(this.rally.getConfig("timer_position"))}catch(e){if("SyntaxError"!=e.name)throw e;t=null}return null===t&&(t={top:0,left:0}),t},updateTimeFormats:function(){if(this.rally.timeSeconds())this.formatTimer=function(t){return moment(t).format("HH:mm:ss.S")},this.formatAbsTime=function(t){return moment(t).format("HH:mm:ss")},this.formatRelTime=function(t){return t>0?moment(1e3*t).format("m:ss"):"0:00"};else{var t=function(t,e){var n=moment(t),i=parseFloat(moment.duration({seconds:n.second(),milliseconds:n.milliseconds()}).asMinutes()),r=n.format(e)+String(i.toFixed(3)).substr(1);return r};this.formatTimer=function(e){return t(e,"HH:mm")},this.formatAbsTime=function(e){return t(e,"HH:mm")},this.formatRelTime=function(e){return e>0?t(1e3*e,"m"):"0:00"}}},timerLap:function(){this.laps.append($("<li />").text(this.formatTimer(this.rally.now())))},timerResetLaps:function(){this.laps.children().remove()},alertDanger:function(t,e){var n=this,i=$("#alert"),r=i.find(".modal-header");r.addClass("alert-danger"),i.find(".modal-title").text(t),i.find(".modal-body").text(e),i.on("hidden.bs.modal",function(t){r.removeClass("alert-danger"),i.unbind("hidden.bs.modal"),n.modalActive=!1}),n.modalActive=!0,i.modal()},alertException:function(t){this.alertDanger("Exception",t.message)},insertInstruction:function(t){var e=this;if(e.selected){var n=e.rally.instruction(e.selected.row);e.rally.addInstruction(n.instr+t).then(function(t){e.selectInstruction(t)})}}}}(),function(){window.Rally=function(){this.init(),this.ui=new RallyUI(this)},Rally.prototype={instructions:[],instruction_map:new Map,instruction_id_map:new Map,last_instr:null,init:function(){var t=this.db=new Dexie("MyDatabase");t.version(1).stores({instructions:["id++","&instr","raw_mlg","cas","delay","mlg","time"].join()}),t.open()["catch"](function(t){alert("Uh oh : "+t)}),this.last_instr=0,this.calculate(),this.cachedClockAdj=this.clockAdj()},cachedClockAdj:0,now:function(){return Date.now()+this.cachedClockAdj},calculate:function(){var t=this,e=null;return this.instruction_map.clear(),this.instruction_id_map.clear(),this.db.instructions.toArray(function(n){t.instructions=n.sort(function(t,e){return t.instr-e.instr}).map(function(n){var i=new RallyInstruction(n);return i.calculate(t,e),t.instruction_map.set(parseFloat(i.instr),i),t.instruction_id_map.set(i.id,i),t.last_instr=i.instr,i.prev=e,e&&(e.next=i),e=i,i}),t.ui.renderInstructions()})},instruction:function(t){return t=parseFloat(t),this.instruction_map.has(t)?this.instruction_map.get(t):null},addInstruction:function(){var t={};if(t.instr=Number.parseFloat(arguments[0]),this.instruction_map.has(t.instr))throw new Error("Instruction numbers must be unique");switch(t.raw_mlg=null,t.cas=null,t.delay=null,t.mlg=null,t.time=null,arguments.length){case 6:t.time=Number.parseInt(arguments[5]);case 5:t.mlg=Number.parseFloat(arguments[4]);case 4:t.delay=Number.parseFloat(arguments[3]);case 3:t.cas=Number.parseInt(arguments[2]);case 2:t.raw_mlg=Number.parseFloat(arguments[1])}var e=this;return this.db.instructions.put(t).then(function(){return e.calculate().then(function(){return t.instr})})},addNextInstruction:function(){return this.last_instr=Math.floor(this.last_instr+1),this.addInstruction(this.last_instr)},setValue:function(t,e,n){var i=this,r=RallyInstruction.prototype.columnDefs[e],a={};n="instr"==r.name?i.parseInstruction(r.format_cb(n)):"tod"==r.name?i.parseTime(n):r.format_cb(n),a[r.name]=n,this.db.instructions.update(t,a).then(function(){i.calculate()})["catch"](function(t){console.log(instr),console.log(a)})},deleteInstruction:function(t){var e=this,n=this.instruction_id_map.get(t);n&&this.last_instr==n.instr&&(n.prev?this.last_instr=n.prev.instr:this.last_instr=0),this.db.instructions.where("id").equals(t)["delete"]().then(function(){e.calculate()})},odomFactor:function(t){return arguments.length>0&&this.setConfig("odom_factor",t),t=this.getConfig("odom_factor"),null===t&&(t=1),Number.parseFloat(t)},casFactor:function(t){return arguments.length>0&&this.setConfig("cas_factor",t),t=this.getConfig("cas_factor"),null===t&&(t=1),Number.parseFloat(t)},rallySpeed:function(t){return arguments.length>0&&this.setConfig("rally_speed",t),t=this.getConfig("rally_speed"),null===t&&(t=1),Number.parseInt(t)},clockAdj:function(t){return arguments.length>0&&(this.setConfig("clock_adj",t),this.cachedClockAdj=this.clockAdj()),t=this.getConfig("clock_adj"),null===t&&(t=0),Number.parseInt(t)},timeSeconds:function(t){return arguments.length>0&&this.setConfig("time_seconds",Boolean(t)),t=this.getConfig("time_seconds"),t=null===t?!0:"true"==t.toLowerCase(),Boolean(t)},adjustMilleage:function(t){return Number.parseFloat(t)*this.odomFactor()},adjustCAS:function(t){return Number.parseFloat(t)*this.casFactor()},getConfig:function(t){return window.localStorage.getItem(t)},setConfig:function(t,e){return window.localStorage.setItem(t,e)},reset:function(){this.db["delete"](),this.init()},parseInstruction:function(t){if(null===t||isNaN(t))throw new Error("Invalid format for instruction");if(this.instruction_map.has(t))throw new Error("Instruction numbers must be unique");return t},parseTime:function(t){var e=null;if(null!==t){if(!t.match(/^\s*[0-9:.]+(\s*[pamPAM]+)?\s*$/))throw new Error("Invalid time format");if(this.timeSeconds())e=moment(t,["h-m-s","h-m","H-m A"]);else if("string"==typeof t&&t.includes(".")){var n=null;if(n=t.match(/^\s*(([0-9]+):)?([0-9]+)\.([0-9]+)(\s*[pamPAM]+)?\s*$/),!n)throw new Error("Invalid time format");e=moment({h:n[2],m:n[3]}),e.add(60*Number.parseFloat("0."+n[4]),"seconds")}else e=moment(t,["h-m-s","h-m","H-m A"]);e=e.isValid()?e.valueOf():null}return e}},window.RallyInstruction=function(t){Object.assign(this,t,{columns:[],prev:null,next:null});var e=this;this.columns=this.columnDefs.map(function(t){return t.cloneWith(e)})},RallyInstruction.prototype={columnDefs:[],col:function(t){var e=-1;if(e="string"==typeof t?this.columns.findIndex(function(e){return e.name==t}):t,0>e||e>=this.columns.length)throw new Error("Invalid index: "+t);return this.columns[e]},formatMilleage:function(t,e){return Math.round(1e3*t)/1e3},formatDeltaTime:function(t){var e=~~(t/60);return e+":"+Math.round(100*t)/100},calculate:function(t,e){var n=(this.col("instr"),this.col("raw_mlg")),i=this.col("raw_d_mlg"),r=this.col("mlg"),a=this.col("d_mlg"),o=this.col("cas"),l=this.col("delay"),s=this.col("tod"),c=this.col("time"),u=this.col("d_time");if(e){var d={};d.instr=e.col("instr"),d.raw_mlg=e.col("raw_mlg"),d.raw_d_mlg=e.col("raw_d_mlg"),d.mlg=e.col("mlg"),d.d_mlg=e.col("d_mlg"),d.cas=e.col("cas"),d.delay=e.col("delay"),d.tod=e.col("tod"),d.time=e.col("time"),d.d_time=e.col("d_time"),e=d}this.columns.forEach(function(t){t.isSet()&&(t.calculated_value=t.value)});var m=function(t,n,i){this.calc=function(){t.isSet()?t.calculated_value=t.value:e&&i?t.calculated_value=i():t.calculated_value=n}},h=function(t,e){this.calc=function(){t.calculated_value=e()}},f=[new m(i,0,function(){var t=n.calculated_value-e.raw_mlg.calculated_value;return 0>t?0:t}),new h(a,function(){return t.adjustMilleage(i.calculated_value)}),new m(r,0,function(){return 0===n.calculated_value?0:e.mlg.calculated_value+a.calculated_value}),new m(o,NaN,function(){return e.cas.calculated_value}),new m(l,0,null),new m(u,0,function(){return 3600*i.calculated_value/e.cas.calculated_value+l.calculated_value}),new m(c,0,function(){return e.time.calculated_value+u.calculated_value}),new m(s,0,function(){return e.tod.calculated_value+1e3*u.calculated_value}),new m(n,0,function(){return r.isSet()&&null===n.value?e.raw_mlg.calculated_value+(r.calculated_value-e.mlg.calculated_value):0})];f.forEach(function(t){t.calc()})}},RallyInstruction.prototype.Column=function(t,e,n,i,r){this.index=t,this.name=e,this.label=n,this.is_db=i,this.format_cb=r,Object.defineProperty(this,"value",{get:function(){return this.instance?this.format_cb(this.instance[this.name]):void 0},set:function(t){this.instance&&(this.instance[this.name]=this.format_cb(t))}}),Object.defineProperty(this,"display_value",{get:function(){return this.instance?this.isSet()?this.value:this.calculated_value:void 0}})},RallyInstruction.prototype.Column.prototype={index:null,name:null,label:null,is_db:null,calculated_value:null,instance:null,cloneWith:function(t){var e=new RallyInstruction.prototype.Column;return Object.assign(e,this),e.instance=t,e},isCalculated:function(){if(!this.instance)throw"Instance not set";return null===this.value},isSet:function(){if(!this.instance)throw"Instance not set";return this.is_db&&null!==this.value},toString:function(){return this.display_value}},RallyInstruction.prototype.parseFixedFloat=function(t){return function(e){var n=Number.parseFloat(e);return n=isNaN(n)?null:n.toFixed(t)}},RallyInstruction.prototype.parseFloat=function(t){var e=Number.parseFloat(t);return isNaN(e)&&(e=null),e},RallyInstruction.prototype.parseInt=function(t){var e=Number.parseInt(t);return isNaN(e)&&(e=null),e},RallyInstruction.prototype.columnDefs=[new RallyInstruction.prototype.Column(0,"instr","Instr",!0,RallyInstruction.prototype.parseFixedFloat(1)),new RallyInstruction.prototype.Column(1,"raw_mlg","Raw Mlg",!0,RallyInstruction.prototype.parseFloat),new RallyInstruction.prototype.Column(2,"raw_d_mlg","Raw &Delta;Mlg",!1,RallyInstruction.prototype.parseFloat),new RallyInstruction.prototype.Column(3,"mlg","Mlg",!0,RallyInstruction.prototype.parseFloat),new RallyInstruction.prototype.Column(4,"d_mlg","&Delta;Mlg",!1,RallyInstruction.prototype.parseFloat),new RallyInstruction.prototype.Column(5,"cas","CAS",!0,RallyInstruction.prototype.parseInt),new RallyInstruction.prototype.Column(6,"delay","Delay",!0,RallyInstruction.prototype.parseFloat),new RallyInstruction.prototype.Column(7,"tod","TOD",!0,RallyInstruction.prototype.parseInt),new RallyInstruction.prototype.Column(8,"time","Time",!1,RallyInstruction.prototype.parseInt),new RallyInstruction.prototype.Column(9,"d_time","&Delta;Time",!1,RallyInstruction.prototype.parseFloat)]}();