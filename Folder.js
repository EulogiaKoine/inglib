"use strict"

inspire('extension.Array.at')

/**
 * @name Folder
 * @class
 * @author Koinē
 * @version 0.1
 * @update
 *  2023-08-22 alpha initialized
 *
 * @description
 *  문서(Document)를 트리 구조로 관리하기 위한 클래스
 */

module.exports = function(path, r_inspire){

const { Document } = r_inspire('Document')
const DELETE_CODE = Symbol('delete')

/** @assert this instanceof Folder == true */
function Folder(path){
    if(typeof path === "string"){
        this.path = path
        this.$contents = {}
        this.load()
        return this
    }
    throw new TypeError('Folder - path must be a string')
}

Object.defineProperty(Folder.prototype, 'load', {
    value(){
        if(java.io.File(this.path).isDirectory()){
            const list = java.io.File(this.path).list()
            let path, doc
            for(let name of list){
                path = this.path + '/' + name
                if(java.io.File(path).isDirectory() && !(name in this.$contents)){ // 없는 것만 불러움
                    // Document 판정
                    if(java.io.File(path + '/' + Document.INFO_FILE).isFile() && java.io.File(path + '/' + Document.CONTENT_FILE).isFile()){
                        doc = new Document(path)
                        this.$contents[doc.title] = doc
                    }
                    // 어쨌든 디렉토리니까 Document가 아니라면 Folder 판정
                    else this.$contents[name] = new Folder(path)
                }
            }
            return true
        }
        return false
    }
})

Object.defineProperty(Folder.prototype, 'toString', {
    value(){ return "[object Folder]" }
})

Object.defineProperty(Folder.prototype, 'name', {
    get(){
        return this.path.split('/').at(-1)
    }
})

Object.defineProperty(Folder.prototype, 'rename', {
    value(name){
        if(typeof name === "string" && name.length !== 0){
            const prev = java.nio.file.Paths.get(this.path)
            this.path = this.path.split('/')
            this.path[this.path.length-1] = name
            this.path = this.path.join('/')
            if(java.nio.file.Files.exists(prev)){
                return java.nio.file.Files.move(
                    prev,
                    java.nio.file.Paths.get(this.path),
                    java.nio.file.StandardCopyOption.ATOMIC_MOVE)
            }
            return false
        } else {
            throw new TypeError("Folder.rename - name must be a string")
        }
    }
})

Object.defineProperty(Folder.prototype, 'renameSub', {
    value(sub, name){
        if(sub in this.$contents){
            if(typeof name === "string" && name.length !== 0){
                this.$contents[sub].rename(name)
                this.$contents[name] = this.$contents[sub]
                delete this.$contents[sub]
                return true
            }
            throw new TypeError("Folder.renameSub - new name must be a string")
        }
        return false
    }
})

Object.defineProperty(Folder.prototype, 'list', {
    get(){
        return Object.keys(this.$contents)
    }
})

Object.defineProperty(Folder.prototype, 'docs', {
    get(){
        return Object.keys(this.$contents).filter(v => this.$contents[v] instanceof Document)
    }
})

Object.defineProperty(Folder.prototype, 'folders', {
    get(){
        return Object.keys(this.$contents).filter(v => this.$contents[v] instanceof Folder)
    }
})

/**
 * @returns {Object}
 * {
 *    name: string FolderName
 *    branches: [
 *        string documentName
 *        {
 *            name: string SubFolderName
 *            branches: [...recursive...]
 *        }
 *    ]
 * }
 */
Object.defineProperty(Folder.prototype, 'tree', {
    get(){
        const res = { name: this.name, branches: [] }
        for(let content in this.$contents){
            content = this.$contents[content]
            if(content instanceof Folder)
                res.branches.push(content.tree)
            else
                res.branches.push(content.title)
        }
        return res
    }
})

// 바로 하위에 Document/Folder 추가
Object.defineProperty(Folder.prototype, 'add', {
    value(content){
        if(content instanceof Folder || content instanceof Document){
            const name = content.name
            if(name in this.$contents)
                throw new TypeError('Folder.add/' + this.name + ' - ' + name + ' already exists')
            this.$contents[name] = content
        } else {
            throw new TypeError('Folder.add - can only add Folder or Document')
        }
    }
})

// 자신의 경로에 디렉토리 생성
Object.defineProperty(Folder.prototype, 'mkdir', {
    value(){
        java.io.File(this.path).mkdirs()
    }
})

// 재귀적으로 모두 저장
Object.defineProperty(Folder.prototype, 'save', {
    value(){
        this.mkdir()
        for(let content of this.$contents)
            content.save()
    }
})

// 재귀적으로 목표 탐색
// 요청 양식은 폴더/문서
Object.defineProperty(Folder.prototype, 'search', {
    value(req){
        if(Array.isArray(req)){
            if(req.length === 0)
                throw new RangeError('Folder.search - please give least one request')
            if(req.length === 1)
                return this.$contents[req]
            const sub = this.$contents[req[0]]
            if(sub instanceof Folder)
                return sub.search(req.slice(1))
            throw new TypeError('Folder.search/' + this.name + ' - ' + req[0] + ' is not a folder; cannot search sub content')
        }
        if(typeof req === "string")
            return this.search(req.split('/'))
        throw new TypeError('Folder.search - request must be Array<string> or string')
    }
})


Object.defineProperty(Folder, 'DELETE_CODE', {
    value: DELETE_CODE, enumerable: true
})

// 하위 경로 영구 삭제; req가 공백이라면 자기 자신을.
Object.defineProperty(Folder.prototype, 'delete', {
    value(req, code){
        if(code === DELETE_CODE){
            if(Array.isArray(req)){
                if(req.length === 0){
                    for(let content in this.$contents){
                        content = this.$contents[content]
                        if(content instanceof Document)
                            content.deleteAll(Document.DELETE_CODE)
                        else if(content instanceof Folder)
                            content.delete([], DELETE_CODE)
                    }
                    if(FileStream.remove(this.path) === false)
                        throw new Error("Folder.delete - failed to delete folder " + this.path + "; please check the directory")
                    return true
                }
                const target = this.$contents[req[0]]
                if(target instanceof Folder){
                    delete this.$contents[req[0]]
                    return target.delete(req.slice(1), code)
                } else if(target instanceof Document){
                    delete this.$contents[req[0]]
                    return target.deleteAll(Document.DELETE_CODE)
                }
                throw new Error("Folder.delete - invalid path " + req[0])
            } else if(typeof req === "string" && req.length !== 0){
                return this.delete(req.split('/'), code)
            } else {
                return this.delete([], code)
            }
        }
        return false
    }
})


return { Folder: Folder }
}