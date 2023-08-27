"use strict"
inspire('util.File')
inspire('extension.Array.at')
inspire('extension.Date.format')
inspire('extension.Date.fromFormat')

/**
 * @name Document
 * @class
 * @author Koinē
 * @version 0.1
 * @update
 *  2023-08-22 alpha initialized
 *
 * @description
 *  문서를 외적인 정보(작성자, 작성일, 로그 등)와 내용으로 분리해서 파일로 관리하는 클래스
 */

module.exports = (function(){

// 문서의 정보
const schema = {
    title: null, // string
    author: null, // 작성 저자 순서  -> 길이: 누적 수정 횟수, 마지막 저자: authors[-1]
    log: [] // 변경 기록
    /*
    log: [{
        string author: 편집자
        int change: 수정된 글자수
        int date: 수정 일시의 밀리초 단위 기록 -> new Date(date)시 당시 날짜 불러오기 가능
    }]
     */
}
const TITLE_REG = /[^./\\:*?"<>|]+/
const EMPTY_TEXT = "⨶"
const LOG_DATE_FORMAT = "YYYY-MM-dd HH_mm_ss"
const LOG_DIR = "history"
const INFO_FILE = 'info.json'
const CONTENT_FILE = 'content.txt'
const DELETE_CODE = Symbol('delete')

/**
 * @assert typeof (path, author) == "string"
 * @assert date instanceof Date == true
 */
function generateLogFilePath(path, author, date){
    author = author.replace(/\\|\/|\:|\*|\?|\"|\<|\>|\|/g, ' ') // 파일 이름으로 불가능한 기호 모두 공백으로 치환
    return path + '/' + LOG_DIR + '/' + date.format(LOG_DATE_FORMAT) + '(by ' + author + ').txt'
}

/** @assert this instanceof Document == true */
function Document(path){
    if(typeof path === "string"){
        /** @private {string} */
        this.path = path
        this.$info = new File(path + '/' + INFO_FILE, true)
        this.$content = new File(path + '/' + CONTENT_FILE)

        if(this.$info.exists)
            this.info = this.$info.load()
        else this.info = this.$info.write(Object.assign({}, schema))
        if(!this.info.title)
            this.setTitle(this.name)

        return this
    }
    throw new TypeError('Document - path must be a string')
}


Object.defineProperties(Document, {
    INFO_FILE: { value: INFO_FILE, enumerable: true },
    CONTENT_FILE: { value: CONTENT_FILE, enumerable: true },
    LOG_DIR: { value: LOG_DIR, enumerable: true }
})

Object.defineProperty(Document.prototype, 'toString', {
    value(){ return "[object Document]" }
})


Object.defineProperty(Document.prototype, 'exists', {
    get(){
        return this.$info.exists && this.$content.exists
    }
})

Object.defineProperty(Document.prototype, 'name', {
    get(){
        return this.path.split('/').at(-1)
    }
})

Object.defineProperty(Document.prototype, 'rename', {
    value(name){
        if(typeof name === "string" && name.length !== 0){
            const prev = java.nio.file.Paths.get(this.path)
            this.path = this.path.split('/')
            this.path[this.path.length-1] = name
            return java.nio.file.Files.move(
                prev,
                java.nio.file.Paths.get(this.path = this.path.join('/')),
                java.nio.file.StandardCopyOption.ATOMIC_MOVE)
        } else {
            throw new TypeError("Document.rename - name must be a string")
        }
    }
})

Object.defineProperty(Document.prototype, 'read', {
    value(){
        return (this.$content.read() === null || this.$content.read() === EMPTY_TEXT)
            ? (this.$content.exists? this.$content.load(true): null)
            : this.$content.read()
    }
})

Object.defineProperty(Document.prototype, 'title', {
    get(){
        return this.info.title
    }
})

Object.defineProperty(Document.prototype, 'setTitle', {
    value(title){
        if(typeof title === "string" && TITLE_REG.test(title))
            this.info.title = title
        else
            throw new TypeError("Document.setTitle - title must be a string satisfying the condition RegExp " + TITLE_REG.toString())
    }
})

Object.defineProperty(Document.prototype, 'write', {
    value(content, author){
        if(typeof content === "string" && typeof author === "string"){
            this.$content.write(content)
            this.info.author = author
        } else throw new TypeError("Document.write - content and author must be a string")
    }
})

Object.defineProperty(Document.prototype, 'save', {
    value(){
        if(this.$content.read() === EMPTY_TEXT)
            return false

        // 로그 남기기
        const date = new Date()
        const content = this.$content.read()
        this.info.log.push({
            author: this.info.author,
            change: (this.info.log.length
                ? content.length - this.info.log.reduce((wordCount, currLog) => wordCount + currLog.change, 0) // 현재까지의 누적 변화의 합 = 마지막 글의 글자수
                : content.length),
            date: date.getTime()
        })

        const log = new File(generateLogFilePath(this.path, this.info.author, date))
        log.write(content) // 현재 내용 기록하고
        log.save() // 로그로 저장

        this.$info.save() // 정보와
        this.$content.save() // 현재 내용도 파일로 저장
        this.$content.write(EMPTY_TEXT) // 메모리의 내용은 지워서 메모리 절약

        return true
    }
})


/**
 * @returns {[{ author: string, change: number, date: Date}]}
 */
Object.defineProperty(Document.prototype, 'getLog', {
    value(){
        return this.info.log.map(log => ({
            author: log.author,
            change: log.change,
            date: new Date(log.date)
        }))
    }
})


// id = 0, 1, ... 순으로 최신 오름차순
Object.defineProperty(Document.prototype, 'reminisce', {
    value(id){
        if(id in this.info.log){ // 개수는 맞으니까 괜찮
            const log = this.info.log.at(-(id+1)) // 뒤에서부터
            return FileStream.read(generateLogFilePath(this.path, log.author, new Date(log.date)))
        }
        return null
    }
})

// 특정 번호의 로그를 제거
Object.defineProperty(Document.prototype, 'removeLog', {
    value(id){
        if(id in this.info.log){
            id = -(id + 1)
            const log = this.info.log.at(id)
            this.info.log.splice(id, 1)
            FileStream.remove(generateLogFilePath(this.path, log.author, new Date(log.date)))
            return true
        }
        return false
    }
})

// 모든 로그 제거
Object.defineProperty(Document.prototype, 'clearLog', {
    value(){
        for(let log of this.info.log)
            FileStream.remove(generateLogFilePath(this.path, log.author, new Date(log.date)))
        this.info.log = []
        FileStream.remove(this.path + '/' + LOG_DIR)
    }
})


Object.defineProperty(Document, 'DELETE_CODE', { value: DELETE_CODE, enumerable: true })

// 문서의 모든 걸 영구적으로 제거
Object.defineProperty(Document.prototype, 'deleteAll', {
    value(code){
        if(code === DELETE_CODE){
            this.clearLog()
            this.$info.delete()
            this.$content.delete()
            if(!FileStream.remove(this.path)) // Document가 직접 생성한 파일을 모두 제거했음에도 폴더 삭제에 실패했을 때, 곧 예상치 못한 파일이 존재할 경우
                throw new Error("Document.deleteAll/" + this.path + " - failed to delete the document; please check the directory")
            return true
        }
        return false
    }
})






return { Document: Document }
})()