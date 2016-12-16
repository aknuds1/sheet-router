const window = require('global/window')
const pathname = require('./_pathname')
const wayfarer = require('wayfarer')
const assert = require('assert')
const Promise = require('bluebird')

const isElectron = (window.process && window.process.type)

module.exports = sheetRouter

// Fast, modular client router
// fn(str, any[..]) -> fn(str, any[..])
function sheetRouter (opts, tree) {
  if (!tree) {
    tree = opts
    opts = {}
  }

  assert.equal(typeof opts, 'object', 'sheet-router: opts must be a object')
  assert.ok(Array.isArray(tree), 'sheet-router: tree must be an array')

  const dft = opts.default || '/404'
  assert.equal(typeof dft, 'string', 'sheet-router: dft must be a string')

  const router = wayfarer(dft)
  var prevCallback = null
  var prevRoute = null

  match._router = router

  // register tree in router
  // tree[0] is a string, thus a route
  // tree[0] is an array, thus not a route
  // tree[1] is a function
    // tree[2] is an array
    // tree[2] is not an array
  // tree[1] is an array
  ;(function walk (tree, fullRoute) {
    if (typeof tree[0] === 'string') {
      var route = tree[0].replace(/^[#/]/, '')
    } else {
      var rootArr = tree[0]
    }

    let cb
    let children
    let loadData
    const secondEntry = tree[1]
    const secondEntryType = typeof secondEntry
    if (secondEntryType === 'function') {
      cb = secondEntry
    } else if (Array.isArray(secondEntry)) {
      children = secondEntry
    } else if (secondEntryType === 'object') {
      cb = secondEntry.render
      loadData = secondEntry.loadData
      assert.notEqual(cb, null)
    }

    if (children == null && Array.isArray(tree[2])) {
      children = tree[2]
    }

    if (rootArr) {
      tree.forEach(function (node) {
        walk(node, fullRoute)
      })
    }

    if (cb) {
      const innerRoute = route
        ? fullRoute.concat(route).join('/')
        : fullRoute.length ? fullRoute.join('/') : route

      if (loadData != null) {
        // Load data for the route
        // If it returns a promise, return a loader
        // When promise resolves, trigger a re-render with fetched data
        // Else, return the value
        cb = (...args) => {
          console.log(`Loading data`)
          Promise.method(loadData)()
            .then(() => {
              console.log(`Data loaded, calling cb`)
              cb(...args)
            })
          }
        }
      }

      // if opts.thunk is false or only enabled for match, don't thunk
      const handler = (opts.thunk === false || opts.thunk === 'match')
        ? cb
        : thunkify(cb)
      router.on(innerRoute, function wrapHandler (...args) {

      })
    }

    if (Array.isArray(children)) {
      walk(children, fullRoute.concat(route))
    }
  })(tree, [])

  return match

  // match a route on the router
  //
  // no thunking -> call route with all arguments
  // thunking only for match -> call route with all arguments
  // thunking and route is same -> call prev cb with new args
  // thunking and route is diff -> create cb and call with new args
  //
  // (str, [any..]) -> any
  function match (route, arg1, arg2, arg3, arg4, arg5) {
    console.log(`Match called`, route)
    assert.equal(typeof route, 'string', 'sheet-router: route must be a string')

    if (opts.thunk === false) {
      return router(pathname(route, isElectron), arg1, arg2, arg3, arg4, arg5)
    } else if (route === prevRoute) {
      return prevCallback(arg1, arg2, arg3, arg4, arg5)
    } else {
      prevRoute = pathname(route, isElectron)
      console.log(`prevRoute: ${prevRoute}`)
      prevCallback = router(prevRoute)
      const ret = prevCallback(arg1, arg2, arg3, arg4, arg5)
      console.log(`Thunked returned`, ret)
      return ret
    }
  }
}

// wrap a function in a function so it can be called at a later time
// fn -> obj -> (any, any, any, any, any)
function thunkify (cb) {
  return function (params) {
    return function thunked (arg1, arg2, arg3, arg4, arg5) {
      return cb(params, arg1, arg2, arg3, arg4, arg5)
    }
  }
}
