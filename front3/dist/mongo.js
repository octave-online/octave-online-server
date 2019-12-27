"use strict";
/*
 * Copyright © 2019, Octave Online LLC
 *
 * This file is part of Octave Online Server.
 *
 * Octave Online Server is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * Octave Online Server is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
 * License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Octave Online Server.  If not, see
 * <https://www.gnu.org/licenses/>.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const Mongoose = require("mongoose");
const shared_1 = require("@oo/shared");
function connect() {
    var url = `mongodb://${shared_1.config.mongo.hostname}:${shared_1.config.mongo.port}/${shared_1.config.mongo.db};`;
    return Mongoose.connect(url, {
        useNewUrlParser: true,
    });
}
exports.connect = connect;
exports.connection = Mongoose.connection;
