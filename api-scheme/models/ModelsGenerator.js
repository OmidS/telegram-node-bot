'use strict'

const SchemeClassField = require('./SchemeClassField')
const SchemeClass = require('./SchemeClass')
const cheerio = require('cheerio')

const JS_TYPES = {
    Integer: 'number',
    String: 'string',
    Float: 'number',
    'Float number': 'number',
    'InputFile or String': 'string',
    Boolean: 'boolean',
    True: 'boolean',
    False: 'boolean'
}

class ModelsGenerator {
    /**
     *
     * @param {string} docPageData
     */
    constructor(docPageData) {
        this._docPageData = docPageData
    }

    /**
     *
     * @returns {SchemeClass[]}
     */
    generateModels() {
        let models = []

        let scheme = this._generateScheme()

        scheme.forEach(model => {
            models.push(new SchemeClass(
                model.name,
                this._prepareFields(model.fields),
                model.desc,
                model.altTypes
            ))
        })

        return models
    }

    /**
     *
     * @param {string} table
     * @returns {SchemeClassField[]}
     * @private
     */
    _prepareFields(raw) {
        let fields = []



        raw.forEach(item => {
            let type = this._prepareType(item.type)

            fields.push(new SchemeClassField(
                item.field,
                type,
                item.type.indexOf('Array of Array of') > -1 ? '2d array' : (item.type.indexOf('Array of') > -1 ? 'array' : ''),
                this._isStandart(item.type),
                !item.required,
                item.desc
            ))
        })

        return fields
    }

    _prepareType(type) {
        type = type.replace('Array of Array of ', '').replace('Array of ', '')

        if (JS_TYPES[type]) {
            return JS_TYPES[type]
        }

        return type
    }

    _isStandart(type) {
        type = type.replace('Array of Array of ', '').replace('Array of ', '')

        if (JS_TYPES[type]) {
            return true
        }

        return false
    }


    _generateScheme() {
        let $ = cheerio.load(this._docPageData)

        const apiScheme = []

        $("h4").each((index, el) => {
            let siblings = new Array();
            siblings.push( el )
            for (let i=0; i<10; i++){
                let next = $(siblings[siblings.length-1]).next()
                if ((next.prop("tagName") == 'H4') || (next.prop("tagName") == 'H3')) break
                siblings.push( next[0] )
                if (next.prop("tagName") == 'TABLE') break
            }
            const nextTag = $(el).next().prop("tagName")
            const nextNextTag = $(el).next().next().prop("tagName")
            const nextNextNextTag = $(el).next().next().next().prop("tagName")

            try {
                console.log('Checking if h4: "'+ $(el).text()+'" is a model or dummy type')
            } catch (e) {
                console.log( e )
            }
            if (
                nextTag == 'P' &&
                ( nextNextTag == 'TABLE'
                || nextNextTag == 'BLOCKQUOTE' && nextNextNextTag == 'TABLE'
                || ($(el).text() == 'LoginUrl')
                )
            ) {
                let isModel = true
                var model = {}

                // if ($(siblings[siblings.length-1]).prop("tagName") != 'TABLE'){
                //     console.log('Discrepency');
                // }

                model.name = $(el).text()
                model.desc = $(el).next().text()
                model.fields = []

                if (nextNextTag == 'TABLE') var table =  $(el).next().next().children().children()
                if (nextNextTag == 'BLOCKQUOTE') var table =  $(el).next().next().next().children().children()
                if ($(el).text() == 'LoginUrl') var table = $(siblings[siblings.length-1]).children().children()
                
                // let table2 = $(siblings[siblings.length-1])
                // let table_content = table2.children().children()
                // if (table_content[0] !== table[0]){
                //     console.log('Discrepency!')
                // }

                table.each((i, item) => {
                    let fieldRaw = []

                    $(item).children().each((i, line) => fieldRaw.push($(line).text()))

                    if (i === 0) {
                        isModel = fieldRaw[0] == "Field"
                        return
                    }

                    let field = {}
                    field.field = fieldRaw[0]
                    field.type  = fieldRaw[1]

                    if (isModel) {
                        const optionalRegexp = fieldRaw[2].match(/^Optional. (.*)$/)

                        if (optionalRegexp != null) {
                            fieldRaw[3] = optionalRegexp[1]
                        } else {
                            fieldRaw[3] = fieldRaw[2]
                            fieldRaw[2] = true
                        }
                    }

                    field.required = fieldRaw[2] == true
                    field.desc = fieldRaw[3]

                    model.fields.push(field)
                })

                if (isModel) apiScheme.push(model)
            } else if ($(siblings[siblings.length-1]).prop("tagName") == 'UL'){
                // Is an umbrella model that can be a list of other types
                let isModel = true
                var model = {}
                model.name = $(el).text()
                model.desc = $(el).next().text()
                model.fields = []
                if (model.name == model.name.replace(/\s/g, "")) {
                    let listItems = $(siblings[siblings.length-1]).children()
                    let listItemsText = []
                    for (let i = 0; i<listItems.length; i++){
                        let ch = $(listItems[i]).children();
                        if ($(ch).prop('tagName') == 'A'){
                            listItemsText.push(ch.text())
                        } else {
                            isModel = false;
                        }
                    }
                    model.altTypes = listItemsText

                    if (isModel) apiScheme.push(model)
                }
            } else if (nextTag == 'P') {
                // May be a dummy type
                let isModel = true
                var model = {}

                model.name = $(el).text()
                if (model.name == model.name.replace(/\s/g, "")){
                    if (   (model.name == 'CallbackGame') 
                        || (model.name == 'VoiceChatStarted') 
                        || (model.name == 'InputFile') 
                        || (model.name == 'InputMedia')) {
                        model.desc = $(el).next().text()
                        model.fields = []
                        
                        if (isModel) apiScheme.push(model)
                    }
                }
            }
        })

        return apiScheme
    }
}

module.exports = ModelsGenerator
