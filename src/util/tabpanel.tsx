import {TabPanelProps, useTabContext} from "@material-ui/lab";
import React, {useEffect, useState} from "react";

export function TabPanel(props: TabPanelProps) {
    const {
        children,
        className,
        style,
        value: id,
        ...other
    } = props

    const context = useTabContext()
    if (context === null) {
        throw new TypeError("No TabContext provided")
    }
    const tabId = context.value

    const [visited, setVisited] = useState(false)
    useEffect(() => {
        if (id === tabId) {
            setVisited(true)
        }
    }, [id, tabId]);


    return (
        <>
            {visited &&
            // @ts-ignore
            <div className={'MuiTabPanel-root'}
                 style={{paddingTop: '10px', ...style, display: id === tabId ? "block" : "none",}}
                 {...other}>{children}</div>}
        </>
    )
}
