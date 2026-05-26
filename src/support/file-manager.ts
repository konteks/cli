import {
    cp as cpVendor,
    mkdir as mkdirVendor,
    rm as rmVendor,
} from 'node:fs/promises'

type mkdirParams = Parameters<typeof mkdirVendor>

export function mkdir(path: mkdirParams[0]) {
    return mkdirVendor(path, { recursive: true })
}

type cpParams = Parameters<typeof cpVendor>

export function cp(source: cpParams[0], destination: cpParams[1]) {
    return cpVendor(source, destination, { recursive: true })
}

type rmParams = Parameters<typeof rmVendor>

export function rm(path: rmParams[0]) {
    return rmVendor(path, { force: true, recursive: true })
}
