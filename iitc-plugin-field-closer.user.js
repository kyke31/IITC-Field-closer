// ==UserScript==
// @id             iitc-plugin-field-closer
// @name           IITC plugin: Field Closer Assistant
// @category       Layer
// @version        0.7.1
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @updateURL      none
// @downloadURL    none
// @description    Exhaustive search with Modern UI, CSV Export, Title Sanitization, and Hover Highlights.
// @include        https://intel.ingress.com/*
// @include        http://intel.ingress.com/*
// @match          https://intel.ingress.com/*
// @match          http://intel.ingress.com/*
// @grant          none
// ==/UserScript==

function wrapper(plugin_info) {
    if (typeof window.plugin !== 'function') window.plugin = function() {};

    window.plugin.fieldCloser = function() {};
    var self = window.plugin.fieldCloser;

    self.KEY_SETTINGS = 'plugin-field-closer-settings';

    var ENL_VAL = window.TEAM_ENL || 2;
    var RES_VAL = window.TEAM_RES || 1;

    self.settings = {
        team: ENL_VAL,
        debug: true
    };

    self.analysisResults = { closers: [], opens: [] };
    self.processing = false;
    self.highlightLayer = null; // Store temporary highlight marker

    self.log = function(msg) {
        var now = new Date();
        var yyyy = now.getFullYear();
        var mm = String(now.getMonth() + 1).padStart(2, '0');
        var dd = String(now.getDate()).padStart(2, '0');
        var hh = String(now.getHours()).padStart(2, '0');
        var min = String(now.getMinutes()).padStart(2, '0');
        var ss = String(now.getSeconds()).padStart(2, '0');
        var timestamp = "[" + yyyy + mm + dd + "_" + hh + min + ss + "]";
        console.log(timestamp + ' FieldCloser: ' + msg);
    };

    // --- HELPER: Title Sanitizer ---
    self.getSafeTitle = function(portal) {
        if (!portal || !portal.options || !portal.options.data) return 'Untitled';
        var t = portal.options.data.title || 'Untitled';
        return t.replace(/[.,#"'“”‘’]/g, '').trim();
    };

    // --- LAZY LOAD QUEUE ---
    self.detailQueue = {
        items: [],
        running: false,
        processed: new Set(),

        add: function(guid) {
            if (this.processed.has(guid) || this.items.indexOf(guid) !== -1) return;
            if (window.portalDetail.get(guid)) return;
            this.items.push(guid);
            this.kickstart();
        },

        process: function() {
            var that = this;
            if (this.items.length === 0) {
                this.running = false;
                return;
            }
            this.running = true;
            var guid = this.items.shift();
            this.processed.add(guid);

            if (window.portalDetail.get(guid)) {
                self.onDetailLoaded(guid);
                this.next();
                return;
            }

            var requestPromise = window.portalDetail.request(guid);
            var timeoutPromise = new Promise(function(resolve) { setTimeout(resolve, 3000, 'timeout'); });

            Promise.race([requestPromise, timeoutPromise]).then(function(data) {
                if(data !== 'timeout') self.onDetailLoaded(guid);
            }).finally(function() {
                that.next();
            });
        },

        next: function() {
            var that = this;
            setTimeout(function() { that.process(); }, Math.floor(Math.random() * 200) + 100);
        },

        kickstart: function() {
            if(!this.running && this.items.length > 0) this.process();
        }
    };

    self.onDetailLoaded = function(guid) {
        var needsUpdate = false;
        var updateList = function(list) {
            for(var i=0; i<list.length; i++) {
                var item = list[i];
                if (item.source.options.guid === guid || item.target.options.guid === guid) {
                    var reCheck = self.evaluateLink(item.source.options.guid, item.target.options.guid);
                    if (reCheck.possible) {
                        item.action = reCheck.action;
                        item.details = reCheck.details;
                        item.missingData = reCheck.missingData;
                        item.modsNeeded = reCheck.modsNeeded;
                        needsUpdate = true;
                    }
                }
            }
        };
        updateList(self.analysisResults.closers);
        updateList(self.analysisResults.opens);
        if (needsUpdate) self.displayResults();
    };

    // --- UI SETUP ---
    self.setupUI = function() {
        if(window.IITC && window.IITC.toolbox) {
            window.IITC.toolbox.addButton({ label: 'Field Closer', title: 'Analyze view', action: self.openDialog });
        } else {
             $('#toolbox').append('<a onclick="window.plugin.fieldCloser.openDialog();" title="Analyze view">Field Closer</a>');
        }
        self.setupCSS();
    };

    self.setupCSS = function() {
        $('<style>').prop('type', 'text/css').html(`
            .fc-dialog { display: flex; flex-direction: column; height: 100%; box-sizing: border-box; color: #eee; background: #0e3d4e; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
            .fc-top { flex: 0 0 auto; background: #1b415e; padding: 8px; border-bottom: 1px solid #000; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
            .fc-controls-group { display: flex; align-items: center; gap: 8px; }
            .fc-select { background: rgba(0,0,0,0.3); color: #eee; border: 1px solid #20A8B1; padding: 4px; border-radius: 4px; font-size: 12px; }
            .fc-btn {
                background: rgba(0,0,0,0.4);
                color: #ddd;
                border: 1px solid #444;
                padding: 5px 12px;
                cursor: pointer;
                font-size: 12px;
                border-radius: 4px;
                transition: all 0.2s;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .fc-btn:hover { background: #444; color: #fff; border-color: #888; }
            .fc-btn-primary { background: #20A8B1; color: #fff; border-color: #167a80; }
            .fc-btn-primary:hover { background: #1b9098; }
            .fc-btn-warn { background: #a86600; color: #fff; border-color: #804d00; }
            .fc-btn-warn:hover { background: #bf7300; }
            .fc-status { font-size: 0.85em; color: #bbb; margin-left: auto; white-space: nowrap; }
            .fc-table-container { flex: 1 1 auto; overflow-y: auto; position: relative; background: rgba(0,0,0,0.1); }
            .fc-table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
            .fc-table thead th {
                position: sticky; top: 0; z-index: 10;
                background-color: #1b415e; color: #eee;
                padding: 8px 4px;
                text-align: center;
                border-bottom: 2px solid #000;
                font-weight: 600;
                text-transform: uppercase;
                font-size: 11px;
            }
            .fc-table tbody td { padding: 6px 4px; border-bottom: 1px solid #333; color: #ddd; vertical-align: middle; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .fc-table tbody tr:nth-child(even) { background-color: rgba(0,0,0,0.2); }
            .fc-table tbody tr:hover { background-color: rgba(255,255,255,0.05); }
            .fc-col-source { width: 25%; text-align: left; }
            .fc-col-arrow { width: 4%; text-align: center; color: #666; }
            .fc-col-target { width: 25%; text-align: left; }
            .fc-col-action { width: 20%; text-align: center; }
            .fc-col-mods { width: 12%; text-align: center; color: #ff9900; font-weight: bold; }
            .fc-col-details { width: 14%; text-align: right; font-family: monospace; }
            .fc-link { cursor: pointer; color: #eee; text-decoration: none; font-weight: 500; }
            .fc-link:hover { color: #20A8B1; text-decoration: underline; }
            .fc-section-header td { background-color: #222; color: #20A8B1; font-weight: bold; text-align: left; padding: 6px 10px; border-top: 1px solid #444; border-bottom: 1px solid #444; letter-spacing: 1px; }
            .ui-dialog-field-closer { padding: 0 !important; border: 1px solid #20A8B1; }
            .ui-dialog-field-closer .ui-dialog-titlebar { background: #1b415e; border: 0; border-bottom: 1px solid #20A8B1; color: #fff; padding: 8px 12px; }
        `).appendTo('head');
    };

    self.openDialog = function() {
        var html = $('<div>').addClass('fc-dialog');
        var topSection = $('<div>').addClass('fc-top');
        var leftGroup = $('<div>').addClass('fc-controls-group');
        var teamSelect = $('<select>').addClass('fc-select')
            .append($('<option>').val(ENL_VAL).text('Enlightened'))
            .append($('<option>').val(RES_VAL).text('Resistance'))
            .val(self.settings.team)
            .on('change', function() {
                self.settings.team = parseInt($(this).val());
                self.resetAnalysis();
            });

        leftGroup.append($('<span>').text('Team:').css('font-weight','bold'), teamSelect);
        var rightGroup = $('<div>').addClass('fc-controls-group');
        var btnAnalyze = $('<button>').addClass('fc-btn fc-btn-primary').text('Analyze').on('click', self.analyzeView);
        var btnExport = $('<button>').addClass('fc-btn').text('CSV').on('click', self.exportCSV);
        var btnReset = $('<button>').addClass('fc-btn fc-btn-warn').text('Reset').on('click', self.resetAnalysis);

        rightGroup.append(btnAnalyze, btnExport, btnReset);
        var statusSpan = $('<span>').addClass('fc-status').attr('id', 'fc-status').text('Ready');
        topSection.append(leftGroup, statusSpan, rightGroup);

        var tableContainer = $('<div>').addClass('fc-table-container');
        var table = $('<table>').addClass('fc-table').attr('id', 'fc-results-table');
        var thead = $('<thead>').append(
            $('<tr>').append(
                $('<th>').addClass('fc-col-source').text('Source'),
                $('<th>').addClass('fc-col-arrow').text(''),
                $('<th>').addClass('fc-col-target').text('Target'),
                $('<th>').addClass('fc-col-action').text('Action'),
                $('<th>').addClass('fc-col-mods').text('Mods Needed'),
                $('<th>').addClass('fc-col-details').text('Details')
            )
        );
        var tbody = $('<tbody>').attr('id', 'fc-table-body');
        tbody.html('<tr><td colspan="6" style="text-align:center; padding: 40px; font-style:italic; color:#888;">Pan map to area and click Analyze</td></tr>');
        table.append(thead, tbody);
        tableContainer.append(table);
        html.append(topSection, tableContainer);

        var options = {
            title: 'Field Closer Assistant',
            html: html,
            width: 780, height: 500, minHeight: 300, resizable: true,
            dialogClass: 'ui-dialog-field-closer',
            close: function() {
                // Clean up highlight when dialog closes
                if (self.highlightLayer) {
                    window.map.removeLayer(self.highlightLayer);
                    self.highlightLayer = null;
                }
            }
        };

        if (window.useAndroidPanes()) {
            options.id = 'field-closer-dialog';
            window.dialog(options);
        } else {
            options.position = { my: 'right top', at: 'right-10 top+10', of: '#map' };
            window.dialog(options);
        }
    };

    self.resetAnalysis = function() {
        self.processing = false;
        self.analysisResults = { closers: [], opens: [] };
        self.detailQueue.items = [];
        self.detailQueue.running = false;
        
        // Clear highlights on reset
        if (self.highlightLayer) {
            window.map.removeLayer(self.highlightLayer);
            self.highlightLayer = null;
        }

        $('#fc-table-body').html('<tr><td colspan="6" style="text-align:center; padding: 40px; font-style:italic; color:#888;">Analysis reset. Click Analyze to start.</td></tr>');
        $('#fc-status').text('Ready');
    };

    // --- MAIN LOGIC ---
    self.analyzeView = function() {
        if (self.processing) return;
        self.processing = true;
        self.log('Starting Analysis...');
        $('#fc-status').text('Mapping...');
        $('#fc-table-body').empty().append('<tr><td colspan="6" style="text-align:center; padding:20px;">Scanning Portals & Links...</td></tr>');

        self.detailQueue.items = [];
        self.detailQueue.processed = new Set();
        self.analysisResults = { closers: [], opens: [] };

        var bounds = window.map.getBounds();
        var relevantPortals = [];
        var relevantPortalsMap = {};

        $.each(window.portals, function(guid, p) {
            if (p.options.team === self.settings.team && bounds.contains(p.getLatLng())) {
                relevantPortals.push(guid);
                relevantPortalsMap[guid] = p;
            }
        });

        var graph = {};
        $.each(window.links, function(guid, l) {
            if (l.options.team === self.settings.team) {
                var p1 = l.options.data.oGuid || self.findPortalByLatLng(l.getLatLngs()[0]);
                var p2 = l.options.data.dGuid || self.findPortalByLatLng(l.getLatLngs()[1]);
                if (relevantPortalsMap[p1] && relevantPortalsMap[p2]) {
                    if (!graph[p1]) graph[p1] = [];
                    if (!graph[p2]) graph[p2] = [];
                    if (graph[p1].indexOf(p2) === -1) graph[p1].push(p2);
                    if (graph[p2].indexOf(p1) === -1) graph[p2].push(p1);
                }
            }
        });

        var processedPairs = new Set();
        var fieldClosers = [];
        var openLinks = [];

        // Phase 1: Field Closers
        for (var hubGuid in graph) {
            var neighbors = graph[hubGuid];
            if (neighbors.length < 2) continue;
            for (var i = 0; i < neighbors.length; i++) {
                for (var j = i + 1; j < neighbors.length; j++) {
                    var pA = neighbors[i];
                    var pB = neighbors[j];
                    var pairKey = [pA, pB].sort().join('-');
                    if (processedPairs.has(pairKey)) continue;
                    processedPairs.add(pairKey);

                    if (self.linkExists(pA, pB)) continue;
                    var analysis = self.evaluateLink(pA, pB);
                    if (analysis.possible) {
                        analysis.type = 'FIELD';
                        fieldClosers.push(analysis);
                    }
                }
            }
        }
        self.analysisResults.closers = fieldClosers;
        self.displayResults();

        // Phase 2: Open Links (Chunked)
        var pIdx = 0;
        var pJdx = 1;
        var CHUNK_SIZE = 1500;

        var processChunk = function() {
            if (!self.processing) return;

            var ops = 0;
            while (ops < CHUNK_SIZE && pIdx < relevantPortals.length) {
                while (ops < CHUNK_SIZE && pJdx < relevantPortals.length) {
                    var pX = relevantPortals[pIdx];
                    var pY = relevantPortals[pJdx];
                    pJdx++;
                    ops++;

                    var pairKey2 = [pX, pY].sort().join('-');
                    if (processedPairs.has(pairKey2)) continue;
                    processedPairs.add(pairKey2);

                    if (self.linkExists(pX, pY)) continue;
                    var analysis2 = self.evaluateLink(pX, pY);
                    if (analysis2.possible) {
                        analysis2.type = 'OPEN';
                        openLinks.push(analysis2);
                    }
                }
                if (pJdx >= relevantPortals.length) {
                    pIdx++;
                    pJdx = pIdx + 1;
                }
            }

            if (pIdx < relevantPortals.length) {
                var pct = Math.round((pIdx / relevantPortals.length) * 100);
                $('#fc-status').text('Scanning: ' + pct + '%');
                setTimeout(processChunk, 10);
            } else {
                self.processing = false;
                self.analysisResults.opens = openLinks;
                self.displayResults();
                $('#fc-status').text('Done (' + (fieldClosers.length + openLinks.length) + ' found).');
            }
        };

        if (relevantPortals.length > 1) setTimeout(processChunk, 10);
        else {
            self.processing = false;
            $('#fc-status').text('No portals in view.');
            self.displayResults();
        }
    };

    // --- EVALUATION LOGIC ---
    self.evaluateLink = function(guidA, guidB) {
        var portalA = window.portals[guidA];
        var portalB = window.portals[guidB];
        if (!portalA || !portalB) return { possible: false };

        var latlngA = portalA.getLatLng();
        var latlngB = portalB.getLatLng();

        if (self.checkCrosses(latlngA, latlngB)) return { possible: false };

        var linksA = self.getLinkCount(guidA);
        var linksB = self.getLinkCount(guidB);
        var canThrowA = linksA < 8;
        var canThrowB = linksB < 8;

        if (!canThrowA && !canThrowB) return { possible: false };

        // Deployment Check
        var depA = self.getDeploymentStatus(guidA);
        var depB = self.getDeploymentStatus(guidB);

        var modsNeededStr = "";
        var neededList = [];
        if (depA.missingMods > 0) neededList.push("S:" + depA.missingMods);
        if (depB.missingMods > 0) neededList.push("T:" + depB.missingMods);
        modsNeededStr = neededList.join(' | ');

        if (depA.missingData || depB.missingData) {
             return { possible: true, action: 'Verifying...', details: 'Loading...', missingData: true, source: portalA, target: portalB, modsNeeded: '' };
        }

        if (!depA.full || !depB.full) {
            var actionText = '';
            if (!depA.full && !depB.full) actionText = 'Fully deploy both';
            else if (!depA.full) actionText = 'Fully deploy source';
            else actionText = 'Fully deploy target';

            return {
                possible: true,
                action: actionText,
                details: depA.count + '/8 | ' + depB.count + '/8',
                source: portalA, target: portalB,
                modsNeeded: modsNeededStr
            };
        }

        var dist = latlngA.distanceTo(latlngB);
        var canReachA = self.checkRange(depA.avgLevel, dist);
        var canReachB = self.checkRange(depB.avgLevel, dist);

        if (canThrowA && canReachA) {
            return { possible: true, action: 'Link', details: 'Ready', source: portalA, target: portalB, modsNeeded: modsNeededStr };
        } else if (canThrowB && canReachB) {
             return { possible: true, action: 'Link', details: 'Ready', source: portalB, target: portalA, modsNeeded: modsNeededStr };
        } else {
            var reqLevel = Math.pow(dist / 160, 0.25);
            return {
                possible: true,
                action: 'Upgrade',
                details: 'Need L' + reqLevel.toFixed(1),
                source: portalA, target: portalB,
                modsNeeded: modsNeededStr
            };
        }
    };

    self.getDeploymentStatus = function(guid) {
        var details = window.portalDetail.get(guid);
        var p = window.portals[guid];
        if (!details) {
            self.detailQueue.add(guid);
            return { missingData: true };
        }
        
        var resos = details.resonators || [];
        var count = 0;
        var levelSum = 0;
        resos.forEach(function(r) { if (r) { count++; levelSum += r.level; } });

        var mods = details.mods || [];
        var installedMods = 0;
        mods.forEach(function(m) { if (m) installedMods++; });
        var missingMods = 4 - installedMods;

        return {
            full: count === 8,
            count: count,
            avgLevel: count === 8 ? levelSum / 8 : 0,
            title: self.getSafeTitle(p),
            missingData: false,
            missingMods: missingMods
        };
    };

    self.checkRange = function(avgLevel, dist) {
        return (160 * Math.pow(avgLevel, 4)) >= dist;
    };

    // --- UTILS ---
    self.linkExists = function(guidA, guidB) {
        var exists = false;
        $.each(window.links, function(lGuid, l) {
            var d = l.options.data;
            if (d.oGuid && d.dGuid) {
                if ((d.oGuid === guidA && d.dGuid === guidB) || (d.oGuid === guidB && d.dGuid === guidA)) { exists = true; return false; }
            } else {
                var ll = l.getLatLngs();
                var p1 = self.findPortalByLatLng(ll[0]);
                var p2 = self.findPortalByLatLng(ll[1]);
                if ((p1 === guidA && p2 === guidB) || (p1 === guidB && p2 === guidA)) { exists = true; return false; }
            }
        });
        return exists;
    };

    self.findPortalByLatLng = function(latlng) {
        for (var guid in window.portals) {
            if (window.portals[guid].getLatLng().equals(latlng)) return guid;
        }
        return null;
    };

    self.getLinkCount = function(guid) {
        var count = 0;
        $.each(window.links, function(id, l) {
            if (l.options.data.oGuid === guid) count++;
        });
        return count;
    };

    self.checkCrosses = function(a, b) {
        var crosses = false;
        $.each(window.links, function(guid, l) {
            var ll = l.getLatLngs();
            var c = ll[0];
            var d = ll[1];
            if (c.equals(a) || c.equals(b) || d.equals(a) || d.equals(b)) return;
            if (self.linesIntersect(a.lat, a.lng, b.lat, b.lng, c.lat, c.lng, d.lat, d.lng)) { crosses = true; return false; }
        });
        return crosses;
    };

    self.linesIntersect = function(a,b,c,d,p,q,r,s) {
        var det, gamma, lambda;
        det = (c - a) * (s - q) - (r - p) * (d - b);
        if (det === 0) return false;
        lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
        gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
        return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
    };

    // --- EXPORT CSV ---
    self.exportCSV = function() {
        var closers = self.analysisResults.closers || [];
        var opens = self.analysisResults.opens || [];
        var all = closers.concat(opens);

        if (all.length === 0) {
            alert('No links to export.');
            return;
        }

        var csv = "Type,Source Portal,Target Portal,Action,Mods Needed,Details,Source Maps Link\n";

        all.forEach(function(item) {
            var type = item.type === 'FIELD' ? 'Field Closer' : 'Open Link';
            var sTitle = '"' + self.getSafeTitle(item.source) + '"';
            var tTitle = '"' + self.getSafeTitle(item.target) + '"';
            var act = '"' + item.action.replace(/"/g, '""') + '"';
            var mods = '"' + (item.modsNeeded || '') + '"';
            var det = '"' + item.details.replace(/"/g, '""') + '"';

            var lat = item.source.getLatLng().lat;
            var lng = item.source.getLatLng().lng;
            var mapLink = `"http://googleusercontent.com/maps.google.com/maps?ll=${lat},${lng}"`;

            csv += `${type},${sTitle},${tTitle},${act},${mods},${det},${mapLink}\n`;
        });

        var blob = new Blob([csv], { type: 'text/csv' });
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'field_closer_export.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    // --- DISPLAY ---
    self.displayResults = function() {
        var tbody = $('#fc-table-body');
        tbody.empty();

        var closers = self.analysisResults.closers;
        var opens = self.analysisResults.opens;

        if (closers.length === 0 && opens.length === 0) {
            if (!self.processing) tbody.html('<tr><td colspan="6" style="text-align:center; padding:20px;">No links found.</td></tr>');
            return;
        }

        var sorter = function(a, b) {
            var rankA = (a.action === 'Link') ? 0 : 1;
            var rankB = (b.action === 'Link') ? 0 : 1;
            if (rankA !== rankB) return rankA - rankB;
            return a.distance - b.distance;
        };

        closers.sort(sorter);
        opens.sort(sorter);

        var renderRows = function(list) {
            var MAX_SHOW = 300;
            var displayList = list.slice(0, MAX_SHOW);

            displayList.forEach(function(item) {
                var row = $('<tr>');

                var color = '#00ff00';
                if (item.missingData) color = '#00ffff';
                else if (item.action.indexOf('Deploy') !== -1 || item.action.indexOf('Upgrade') !== -1) color = '#ffce00';

                var linkFunc = function() {
                    window.map.fitBounds([item.source.getLatLng(), item.target.getLatLng()], {padding: [50,50]});
                    if(window.portals[item.source.options.guid]) window.renderPortalDetails(item.source.options.guid);
                };

                // --- NEW HOVER LOGIC ---
                var hoverOn = function(portal) {
                    if(self.highlightLayer) window.map.removeLayer(self.highlightLayer);
                    self.highlightLayer = L.circleMarker(portal.getLatLng(), {
                        radius: 20,
                        color: '#ff00ff', // Magenta
                        fillColor: '#ff00ff',
                        fillOpacity: 0.3,
                        weight: 3,
                        dashArray: '5,5'
                    }).addTo(window.map);
                };
                
                var hoverOff = function() {
                    if(self.highlightLayer) {
                        window.map.removeLayer(self.highlightLayer);
                        self.highlightLayer = null;
                    }
                };
                // -----------------------

                var sTitle = self.getSafeTitle(item.source);
                var tTitle = self.getSafeTitle(item.target);

                var sLink = $('<a>').addClass('fc-link').text(sTitle).on('click', linkFunc)
                    .on('mouseenter', function() { hoverOn(item.source); })
                    .on('mouseleave', hoverOff);

                var tLink = $('<a>').addClass('fc-link').text(tTitle).on('click', linkFunc)
                    .on('mouseenter', function() { hoverOn(item.target); })
                    .on('mouseleave', hoverOff);

                row.append(
                    $('<td>').addClass('fc-col-source').append(sLink),
                    $('<td>').addClass('fc-col-arrow').text('→'),
                    $('<td>').addClass('fc-col-target').append(tLink),
                    $('<td>').addClass('fc-col-action').css('color', color).text(item.action),
                    $('<td>').addClass('fc-col-mods').text(item.modsNeeded),
                    $('<td>').addClass('fc-col-details').text(item.details)
                );
                tbody.append(row);
            });

            if (list.length > MAX_SHOW) {
                 tbody.append($('<tr>').append($('td').attr('colspan', 6).text('... ' + (list.length - MAX_SHOW) + ' more hidden ...').css({'text-align':'center', 'color':'#888'})));
            }
        };

        if (closers.length > 0) {
            tbody.append($('<tr class="fc-section-header"><td colspan="6">Field Closers</td></tr>'));
            renderRows(closers);
        }
        if (opens.length > 0) {
            tbody.append($('<tr class="fc-section-header"><td colspan="6">Possible Connections</td></tr>'));
            renderRows(opens);
        }
    };

    var setup = function() {
        self.setupUI();
        self.log('Plugin loaded (v0.7.1) - Hover Highlights & Mods Needed.');
    };

    if (window.iitcLoaded && typeof setup === 'function') setup();
    else if (window.bootPlugins) window.bootPlugins.push(setup);
    else window.bootPlugins = [setup];
}

var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) {
    info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
}
var script = document.createElement('script');
var textContent = document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+')');
script.appendChild(textContent);
(document.body || document.head || document.documentElement).appendChild(script);
