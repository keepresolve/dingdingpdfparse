// import xlsx from 'node-xlsx'
let path = require('path')
let fs = require('fs'),
    PDFParser = require('pdf2json'),
    nodeExcel = require('excel-export')

let pdfParser = new PDFParser()

class PDF {
    constructor() {}
    async transform(ctx) {
        if (ctx.method.toLowerCase() == 'options') {
            return {
                code: 200
            }
        }
        // let reqParams = ctx.request.body
        let file = ctx.request.files['file']
        let loadPDFR = await this.loadPDF(file)
        if (!loadPDFR) return { code: 500, msg: '加载pdf失败' }
        let { allRows, rows, arr } = loadPDFR
        const data = this.generatorWord(arr)
        const error = await this.writeXLXS(data, file.name)
        if (error) return { code: 500, error }
        // ctx.set('Content-Type', 'application/vnd.openxmlformats')
        // ctx.set('Content-Disposition', 'attachment; filename=' + 'Report.xlsx')
        return {
            code: 200,
            url: `https://${ctx.headers.host}/jiaban/${file.name}.xlsx`
        }
        // return { code: 200, allRows, rows }
    }
    generatorWord(rows) {
        let cols = [
            '姓名',
            '日期',
            '加班时间',
            '加班时长',
            '餐费',
            '交通费',
            '出发地',
            '到达地',
            '其他'
        ]
        let conf = {
            name: 'mysheet',
            cols: cols.map(v => {
                return {
                    caption: v,
                    type: 'string'
                    // beforeCellWrite: function(row, cellData) {
                    //     return cellData.toUpperCase()
                    // }
                    // width: 28.7109375
                }
            }),
            rows
        }
        let data = nodeExcel.execute(conf)
        return data
        // return new Buffer(data, 'binary')
        // conf.rows = []
        // var result = nodeExcel.execute(conf)
        // res.setHeader('Content-Type', 'application/vnd.openxmlformats')
        // res.setHeader(
        //     'Content-Disposition',
        //     'attachment; filename=' + 'Report.xlsx'
        // )
        // res.end(result, 'binary')
    }
    loadPDF(file) {
        return new Promise(resolve => {
            pdfParser.on('pdfParser_dataError', errData => resolve(false))
            pdfParser.on('pdfParser_dataReady', pdfData => {
                // fs.writeFile('./pdf2json/test/F1040EZ.json', JSON.stringify())
                // resolve(pdfParser.getRawTextContent())
                let rows = {}
                let allRows = {}
                let obj = this.transferData(pdfData.formImage.Pages)
                obj.forEach(v => {
                    v.Texts.map(v => {
                        if (!allRows[`${v.y}_${v.x}`]) {
                            let str = (v.R || []).map(s => s.T).join()
                            allRows[`${v.y}_${v.x}`] = v
                            if (/^加班时间(\d).*$/.test(str))
                                rows[str] = {
                                    x: v.x,
                                    y: v.y,
                                    text: (v['R'] || []).map(j => j.T).join()
                                }
                        }
                    })
                })
                let keys = Object.keys(allRows)
                for (const key in rows) {
                    if (rows.hasOwnProperty(key)) {
                        const row = rows[key]
                        const allKeys = keys.filter(
                            v => v.split('_')[0] == row.y
                        )
                        row.contentArr = allKeys.map(v => {
                            return {
                                text: (allRows[v]['R'] || [])
                                    .map(j => j.T)
                                    .join()
                            }
                        })
                    }
                }
                let arr = Object.keys(rows).map(v => {
                    return rows[v]['contentArr'].map(j => j.text)
                })

                resolve({ allRows, rows, arr })
            })
            pdfParser.loadPDF(file.path)
        })
    }
    transferData(data) {
        let type = Object.prototype.toString.call(data)
        switch (type) {
            case '[object Object]':
                for (const key in data) {
                    data[key] = this.transferData(data[key])
                }
                break
            case '[object Array]':
                for (let index = 0; index < data.length; index++) {
                    data[index] = this.transferData(data[index])
                }
                break
            default:
                data = decodeURIComponent(data)
                break
        }
        return data
    }
    writeXLXS(data, fileName) {
        const writePath = path.join(
            __dirname,
            `../../../static/jiaban/${fileName}.xlsx`
        )
        return new Promise(resolve => {
            fs.writeFile(writePath, data, { encoding: 'binary' }, function(
                err
            ) {
                if (err) return resolve(err)
                resolve(null)
            })
        })
    }
}

module.exports = new PDF()
