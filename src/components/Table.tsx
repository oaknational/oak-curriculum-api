import { OakBox } from '@oaknational/oak-components';
import Markdown from 'react-markdown';
import styled from 'styled-components';
import React from 'react';

const Td = styled.td`
  p {
    margin: 16px 0;
  }

  p:first-child {
    margin-top: 0;
  }

  ul {
    margin: 0;
    padding-left: 24px;
    list-style-type: none;
  }

  li {
    padding-left: 0px;
    position: relative;
  }

  li::before {
    content: '•';
    position: absolute;
    left: -1em;
    top: 0;
  }

  p:last-child {
    margin-bottom: 0;
  }
`;

const OakTable = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border-radius: var(--Border-Radius-border-radius-m2, 8px);
  border: 1px solid var(--Tokens-Border-border-decorative1-stronger, #93e892);
  overflow: hidden;
  margin-top: 16px;
  margin-bottom: 32px;

  th,
  td {
    text-align: left;
    padding: 12px;
    vertical-align: top;
    line-height: 1.5;
  }

  tr td:first-child {
    width: 160px;
  }

  th {
    font-weight: bold;
    border-radius: var(--Border-Radius-border-radius-square, 0px)
      var(--Border-Radius-border-radius-square, 0px) 0px 0px;
    background: var(--Tokens-Background-bg-decorative1-main, #bef2bd);
  }

  tr:nth-child(even) {
    background: var(--Tokens-Background-bg-decorative1-very-subdued, #ebfbeb);
  }
`;

export interface TableRowData {
  cells: string[];
  _key: string;
}

export interface TableInterface {
  rows: TableRowData[];
}

export const Table = ({
  value,
}: {
  value: TableInterface;
}): React.ReactElement => {
  const rows = Array.from(value.rows);
  const header = rows.shift();
  return (
    <OakTable>
      <thead>
        {header && (
          <tr>
            {header.cells.map((cell, index) => (
              <th key={index}>
                <OakBox $font={['body-2', 'body-1']}>{cell}</OakBox>
              </th>
            ))}
          </tr>
        )}
      </thead>
      <tbody>
        {rows.map((row) => (
          <TableRow key={row._key} row={row} />
        ))}
      </tbody>
    </OakTable>
  );
};

export const TableRow = ({
  row,
}: {
  row: TableRowData;
}): React.ReactElement => {
  return (
    <tr>
      {row.cells.map((cell, index) => (
        <Td key={index}>
          <OakBox $font={['body-2', 'body-1']}>
            <Markdown>{cell}</Markdown>
          </OakBox>
        </Td>
      ))}
    </tr>
  );
};
