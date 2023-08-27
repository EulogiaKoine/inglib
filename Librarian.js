"use strict"

/**
 * @name Librarian
 * @class
 * @author Koinē
 * @version 0.1
 * @update
 *  2023-08-22 alpha initialized
 *
 * @description
 *  문서 접근 인터페이스
 */

module.exports = function(PATH, r_inspire){

inspire('extension.Array.at')

const { Document } = r_inspire('Document')
const { Folder } = r_inspire('Folder')
const DEFAULT_PATH = PATH + '/library'
const IS_FREE = '$_$FREE$_$'
const DELETE_CODE = Symbol('delete')
const isUsableTitle = t => t.replace(/[0-9A-z가-힣(),!]| /g, '').length === 0

/** @assert this instanceof DocDAO == true */
function Librarian(path){
    if(typeof path !== null && typeof path !== "string" && path.length === 0)
        throw new TypeError("Librarian - path must be string(length > 0) or null")
    this.path = path === null? (path = DEFAULT_PATH): path
    this.$db = new Folder(path)
    this.$table = Librarian.treeToTable(this.$db.tree)
    this.$borrowed = new Set()
}


/**
 * @param {object} Folder.prototype.tree
 * @returns {{
 *    folderName: {
 *        subFolderName: { ... },
 *        documentName: {
 *           [IS_FREE]: bool
 *        }
 *    }
 * }}
 */
Object.defineProperty(Librarian, 'treeToTable', {
    value(tree){
        function set(tree){
            const res = {}
            for(let branch of tree.branches){
                if(typeof branch === "object"){ // folder
                    res[branch.name] = set(branch)
                } else { // document
                    res[branch] = true
                }
            }
            return res
        }
        return set(tree)
    },
    enumerable: true
})

// 사용 가능한 제목인지 판단
Object.defineProperty(Librarian, 'isUsableTitle', {
    value: isUsableTitle,
    enumerable: true
})


// db tree 반환
Object.defineProperty(Librarian.prototype, 'tree', {
    get(){ return this.$db.tree }
})

Object.defineProperty(Librarian.prototype, 'load', {
    value(req){
        if(req === void 0 || typeof req === "string" && req.length !== 0){
            if(req === void 0){
                this.$db.load()
                this.$table = Librarian.treeToTable(this.$db.tree)
            } else {
                if(req.indexOf('/') === -1){
                    this.$db.load()
                    this.$table = Librarian.treeToTable(this.$db.tree)
                } else {
                    const target = this.$db.search(req)
                    if(target instanceof Folder){
                        target.load()
                        this.$table = Librarian.treeToTable(this.$db.tree)
                    }
                }
            }
            return
        }
        throw new TypeError("Librarian.load - invalid path")
    }
})


// 특정 경로(폴더명/문서명)의 폴더/문서의 존재 여부 확인
Object.defineProperty(Librarian.prototype, 'exists', {
    value(req){
        if(!(typeof req === "string" || Array.isArray(req)))
            throw new TypeError("Librarian.exists - path must be string or Array<string>")
        req = typeof req === "string"? req.split('/'): req
        let temp = this.$table[req[0]], i = 0
        while(++i < req.length){
            if(typeof temp === "object") temp = temp[req[i]]
            else return false
        }
        return !!temp
    }
})


// 빌릴 수 있는지 여부(폴더거나, 빌리고 있으면 false)
Object.defineProperty(Librarian.prototype, 'isFree', {
    value(req){
        return !this.$borrowed.has(req) && this.$db.search(req) instanceof Document
    }
})


// 빌리기; 반납될 때까지 해당 문서는 빌릴 수 없음
// req는 폴더/문서
// Book 인스턴스 반환
Object.defineProperty(Librarian.prototype, 'borrow', {
    value(req){
        if(this.exists(req) && this.isFree(req)){
            this.$borrowed.add(req)
            return new Book(this.$db.search(req), (newTitle) => {
                this.$borrowed.delete(req)
                if(newTitle && req.split('/').at(-1) !== newTitle){
                    this.rename(req, newTitle)
                    this.load(req.indexOf('/') === -1? void 0: req.split('/').slice(0, -1).join('/'))
                }
            })
        }
        return null
    }
})


Object.defineProperty(Librarian.prototype, 'read', {
    value(req){
        const doc = this.$db.search(req)
        if(doc instanceof Document)
            return doc.read()
    }
})

// 로그 확인
Object.defineProperty(Librarian.prototype, 'history', {
    value(req){
        const doc = this.$db.search(req)
        if(doc instanceof Document)
            return doc.getLog()
    }
})

// 과거 버전 확인
/**
 * @returns {{
 *    string title
 *    string author
 *    int change
 *    Date date
 *    string content
 * }}
 */
Object.defineProperty(Librarian.prototype, 'reminisce', {
    value(req, id){
        const doc = this.$db.search(req)
        if(doc instanceof Document){
            const res = doc.getLog(id)
            if(typeof res === "object"){
                return Object.assign(res, {
                    content: doc.reminisce(id)
                })
            }
        }
    }
})


// 폴더/폴더 형식의 경로에 새로운 폴더 생성
Object.defineProperty(Librarian.prototype, 'createFolder', {
    value(path){
        if(typeof path === "string" && path.length !== 0){
            path = path.split('/')
            if(path.every(v => isUsableTitle(v))){

                function place(parent, path){
                    const folder = new Folder(parent.path + '/' + path[0])
                    if(path.length === 1){
                        if(parent.folders.indexOf(path[0]) === -1){
                            parent.add(folder)
                            folder.mkdir()
                        }
                    } else {
                        if(parent.folders.indexOf(path[0]) === -1){
                            parent.add(folder)
                            place(folder, path.slice(1))
                        } else {
                            if((parent = parent.search(path[0])) instanceof Folder){
                                place(parent, path.slice(1))
                            } else{
                                throw new Error("Librarian.createFolder - " + path + " is not a folder! cannot make a sub-folder")
                            }
                        }
                    }
                }

                place(this.$db, path)
                this.load(path.join('/'))
            } else {
                throw new TypeError("Librarian.createFolder - cannot use the title of such folder " + path.join('/'))
            }
            return
        }
        throw new TypeError("Librarian.createFolder - invalid path " + path)
    }
})


// 폴더/문서 형식의 경로에 새로운 문서를 생성
Object.defineProperty(Librarian.prototype, 'createDocument', {
    value(path){
        if(typeof path === "string" && path.length !== 0){
            if(path.indexOf('/') === -1){
                if(isUsableTitle(path)){
                    this.$db.add(new Document(this.path + '/' + path))
                } else {
                    throw new TypeError("Librarian.createDocument - cannot use title of such document " + path)
                }
                this.load()
            } else {
                path = path.split('/')
                if(isUsableTitle(path.at(-1))){
                    let parent = path.slice(0, -1).join('/')
                    this.createFolder(parent)
                    const doc = new Document(this.path + '/' + path.join('/'))
                    const target = this.$db.search(parent)
                    if(target.docs.indexOf(doc.title) === -1)
                        target.add(doc)
                } else {
                    throw new TypeError("Librarian.createDocument - cannot use title of such document " + path)
                }
                this.load(path.slice(0,-1).join('/'))
            }
            return
        }
        throw new TypeError("Librarian.createDocument - invalid path " + path)
    }
})


// 이름 바꾸기
Object.defineProperty(Librarian.prototype, 'rename', {
    value(req, name){
        if(typeof req === "string" && req.length !== 0){
            let res
            if(req.indexOf('/') === -1){
                res = this.$db.renameSub(req, name)
                this.load()
            } else {
                req = req.split('/')
                res = this.$db.search(req.slice(0, -1).join('/'))
                if(res instanceof Folder) res = res.renameSub(req.at(-1), name)
                else throw new ReferenceError("Librarian.rename - unexpected error; there's a datum at path " + req + ", however, it's neither Document nor Folder")
                this.load(req.slice(0,-1).join('/'))
            }
            return res
        }
        return false
    }
})



Object.defineProperty(Librarian, 'DELETE_CODE', { value: DELETE_CODE, enumerable: true })

// 책 태우기(없애기)
// target은 폴더/문서 형식의 문자열 request
// 안전을 위해 문서는 Free 상태만, 그리고 DELETE_CODE를 입력해야만 함
Object.defineProperty(Librarian.prototype, 'burn', {
    value(target, code){
        if(code === DELETE_CODE){
            this.$db.delete(target, Folder.DELETE_CODE)
            this.load()
            return true // undefined; 아주 높은 확률의 우연에 의존...
        }
        return false
    }
})




/**
 * 
 * @param {Document} doc
 * @param {function()} returnFn 
 */
function Book(doc, returnFn){
    this.$doc = doc
    this.$returnFn = returnFn
}

Object.defineProperty(Book.prototype, 'title', {
    get(){
        if(this.$doc) return this.$doc.title
        throw new Error("Book.title - it's returned!")
    }
})

Object.defineProperty(Book.prototype, 'setTitle', {
    value(title){
        if(typeof title === "string" && isUsableTitle(title)){
            this.$doc.setTitle(title)
            return true
        }
        return false
    }
})


Object.defineProperty(Book.prototype, 'read', {
    value(){
        if(this.$doc) return this.$doc.read()
        throw new Error("Book.read - it's returned!")
    }
})

Object.defineProperty(Book.prototype, 'edit', {
    value(content, author){
        if(this.$doc instanceof Document) this.$doc.write(content, author)
        else throw new Error("Book.edit - it's returned!")
    }
})

Object.defineProperty(Book.prototype, 'return', {
    value(){
        if(this.$returnFn){
            this.$doc.save()
            this.$returnFn(this.$doc.title)
            delete this.$doc
            delete this.$returnFn
        } else throw new Error("Book.return - it's returned!")
    }
})




return { Librarian: Librarian, Book: Book }
}