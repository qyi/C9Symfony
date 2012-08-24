"use strict";

var util = require("util");

var Plugin = require("../cloud9.core/plugin");
var c9util = require("../cloud9.core/util");

var name = "symfony";
var ProcessManager;
var EventBus;

module.exports = function setup(options, imports, register) {
    ProcessManager = imports["process-manager"];
    EventBus = imports.eventbus;
    imports.ide.register(name, SymfonyPlugin, register);
};

var SymfonyPlugin = function(ide, workspace) {
    Plugin.call(this, ide, workspace);

    this.pm = ProcessManager;
    this.eventbus = EventBus;
    this.workspaceId = workspace.workspaceId;
    this.hooks = ["command"];
    this.name = name;
    this.processCount = 0;
};

util.inherits(SymfonyPlugin, Plugin);

(function() {

    this.init = function() {
        var self = this;
        this.eventbus.on(this.workspaceId + "::symfony", function(msg) {
            if (msg.type == "symfony-start")
                self.processCount += 1;

            if (msg.type == "symfony-exit")
                self.processCount -= 1;

            self.ide.broadcast(JSON.stringify(msg), self.name);
        });
    };

    this.command = function (user, message, client) {
        var cmd = (message.command || "").toLowerCase();

        if (cmd !== "symfony")
            return false;

	message.argv[0] = "app/console";

        var self = this;
        this.pm.spawn("php", {
            args: message.argv,
            cwd: message.cwd,
            nodeVersion: message.version,
            extra: message.extra
        }, this.workspaceId + "::symfony", function(err, pid) {
            if (err)
                self.error(err, 1, message, client);
        });

        return true;
    };

    var symfonyhelp = null;
    var commandsMap = {
        "default": {
            "commands": {
                "[PATH]": {"hint": "path pointing to a folder or file. Autocomplete with [TAB]"}
            }
        }
    };

    this.$commandHints = function(commands, message, callback) {
        var self = this;

        if (!symfonyhelp) {
            this.pm.exec("symfony", {
                args: [],
                cwd: message.cwd
            }, function(code, err, out) {
                if (!out && err)
                    out = err;

                if (!out)
                    return callback();

                symfonyhelp = {"symfony": {
                    "hint": "symfony console",
                    "commands": {}
                }};

                /*
                where <command> is one of:
                */
                out.replace(/[\n\s]*([\w]*)\,/g, function(m, sub) {
                    symfonyhelp.symfony.commands[sub] = self.augmentCommand(sub, {"hint": "symfony '" + sub + "'"});
                });
                onfinish();
            }, null, null);
        }
        else {
            onfinish();
        }

        function onfinish() {
            c9util.extend(commands, symfonyhelp);
            callback();
        }
    };

    this.augmentCommand = function(cmd, struct) {
        var map = commandsMap[cmd] || commandsMap["default"];
        return c9util.extend(struct, map || {});
    };

    this.canShutdown = function() {
        return this.processCount === 0;
    };

}).call(SymfonyPlugin.prototype);