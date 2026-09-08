'use client';

import {
  OakMaxWidth,
  OakBox,
  OakGrid,
  OakGridArea,
  OakLI,
  OakLink,
  OakOL,
  OakAccordion,
  OakP,
  OakSpan,
  OakTertiaryButton,
  OakUL,
} from '@oaknational/oak-components';
import styled from 'styled-components';
import Feature from '@/components/Feature';
import Nav from './Nav';

const OakLiLink = styled(OakLink)`
  text-indent: initial;
`;

const LeftAlignedChildButtons = styled('div')`
  button {
    text-align: left;
  }
`;

const navItems = [
  { title: 'About our open API', href: '#about-api' },
  { title: 'How to get started', href: '#get-started' },
  { title: 'What we offer', href: '#what-we-offer' },
  { title: `What’s available`, href: `#whats-available` },
  { title: 'FAQs', href: '#faqs' },
  { title: 'Give feedback', href: '#give-feedback' },
];

export default function Features(): React.ReactElement {
  return (
    <OakMaxWidth
      $background="bg-primary"
      $color="text-primary"
      $ph={'spacing-16'}
      $flexDirection={'row'}
      $pv="spacing-64"
      // FIXME: styles are being overwritten somewhere so having
      // to declare this.
      $mh={'auto'}
      $maxWidth={['spacing-480', 'spacing-1280']}
    >
      <OakGrid $cg="spacing-24" $rg="spacing-24">
        <OakGridArea
          $colSpan={[12, 4]}
          $alignSelf={'start'}
          $position={['static', 'sticky', 'sticky']}
          $top={'spacing-56'}
          $display={['none', 'block', 'block']}
        >
          <Nav anchorTarget="#open-api-contents" items={navItems} />
        </OakGridArea>
        <OakGridArea
          $colSpan={[12]}
          $position={['static', 'static', 'sticky']}
          $display={['block', 'none', 'none']}
          $pt="spacing-16"
          $pb="spacing-16"
        >
          <OakBox $position="relative">
            <Nav anchorTarget="open-api-contents" items={navItems} />
          </OakBox>
        </OakGridArea>

        <OakGridArea $width={'100%'} $colSpan={[12, 7]} $gap={'spacing-48'}>
          <Feature
            anchorTarget="about-api"
            title="Why are we providing an API?"
          >
            <OakP $font={'body-2'}>
              We’re here to support great teaching. We work to improve pupil
              outcomes and close the disadvantage gap by supporting teachers to
              teach, and enabling pupils to access a high-quality curriculum.
            </OakP>
            <OakP $font={'body-2'}>
              As part of this mission, we are providing an API to make our
              high-quality content available to the wider education market for
              free on the{' '}
              <OakLink
                href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/"
                target="_blank"
              >
                Open Government Licence
              </OakLink>
              . Whether you&apos;re an emerging EdTech start-up, an established
              learning tool, or a quiz-based gaming platform, you can use our
              content with assurance that it has been created in line with the
              latest pedagogical research and aligned with our{' '}
              <OakLink
                href="https://www.thenational.academy/blog/our-approach-to-curriculum"
                target="_blank"
              >
                curriculum design principles
              </OakLink>
              .
            </OakP>
          </Feature>

          <Feature
            variant="mint"
            anchorTarget="get-started"
            title="How to get started"
          >
            <OakOL>
              <OakLI $font={'body-2'}>
                <strong>Sign up</strong>
              </OakLI>
              <OakP $mb="spacing-16">
                <OakLiLink href="https://share.hsforms.com/1gQQFsrHDRf-eZUDajj6NzQbvumd">
                  Request an API key here
                </OakLiLink>
                <OakSpan $ma="auto">
                  , or get in touch with us by sending an email to{' '}
                </OakSpan>
                <OakLink href="mailto:help@thenational.academy?subject=Oak%20OpenAPI">
                  help@thenational.academy
                </OakLink>
                , and we&apos;ll set you up with an API key.
              </OakP>
              <OakLI $mt="spacing-32" $font={'body-2'}>
                <strong>Explore</strong>
              </OakLI>
              <OakP $mb="spacing-16">
                Use our{' '}
                <OakLink href="/playground">
                  interactive developer documentation
                </OakLink>{' '}
                to explore the different endpoints and which resources are most
                appropriate for your use case.
              </OakP>
              <OakLI $font={'body-2'}>
                <strong>Support</strong>
              </OakLI>
              <OakP>
                If you need more help, please
                <OakLink href="https://bvumd.share.hsforms.com/2nacebr1eQuKMoA-vGpkjCA">
                  contact us
                </OakLink>
                . We&apos;ll be happy to support you.
              </OakP>
            </OakOL>
          </Feature>

          <Feature anchorTarget="what-we-offer" title="What we offer">
            <OakUL>
              <OakLI $mb="spacing-12" $font={'body-2'} $display="list-item">
                <strong>Fully resourced curricula</strong>: we are developing
                our resources across the full national curriculum, and have
                content available across multiple subjects and key stages,
                ensuring that you have the materials you need to support a wide
                range of learning requirements.
              </OakLI>
              <OakLI $mb="spacing-12" $font={'body-2'} $display="list-item">
                <strong>High-quality resources</strong>: Benefit from
                meticulously crafted lessons by our expert curriculum partners,
                all aligned to Oak&apos;s research-based curriculum design
                principles. Our resources are designed to engage students and
                support effective teaching and learning.
              </OakLI>
              <OakLI $mb="spacing-12" $font={'body-2'} $display="list-item">
                <OakP>
                  <strong>Flexible integration</strong>: Our API is designed to
                  be flexible and easy to integrate into your existing systems.
                  If you&apos;re looking for an endpoint providing our data in a
                  format you can&apos;t see, let us know and we&apos;ll explore
                  solutions for you.
                </OakP>
              </OakLI>
            </OakUL>
          </Feature>
          <Feature
            anchorTarget="whats-available"
            title="What data is available"
          >
            <OakP $font="body-2">
              Access fully resourced lessons across the national curriculum,
              created by our expert curriculum partners, each including:
            </OakP>
            <OakUL>
              <OakLI $mb={'spacing-8'} $font={'body-2'} $display="list-item">
                Teacher-led lesson videos
              </OakLI>
              <OakLI $mb={'spacing-8'} $font={'body-2'} $display="list-item">
                Oak formatted slide decks
              </OakLI>
              <OakLI $mb={'spacing-8'} $font={'body-2'} $display="list-item">
                Starter and exit quizzes
              </OakLI>
              <OakLI $mb={'spacing-8'} $font={'body-2'} $display="list-item">
                Worksheets
              </OakLI>
              <OakLI $mb={'spacing-8'} $font={'body-2'} $display="list-item">
                Interactive activities
              </OakLI>
            </OakUL>

            <OakTertiaryButton
              element="a"
              href="https://docs.google.com/document/d/1fWRXIsB8qOV2lTIsZSsCILBQa6zvgCPIfskbrEMX8oE/view"
              isTrailingIcon
              iconName="arrow-right"
            >
              Download data overview (PDF)
            </OakTertiaryButton>
          </Feature>

          <Feature anchorTarget="faqs" title="FAQs">
            <LeftAlignedChildButtons>
              <OakAccordion header="What are ‘slugs’?" id="accordion-slugs">
                <OakBox $pt="spacing-12">
                  <OakP $font="body-2">
                    Slugs are a way of uniquely identifying different lessons,
                    units or key stages. These are likely to be used for
                    technical purposes for identification rather than ever
                    displayed to users.
                  </OakP>
                </OakBox>
              </OakAccordion>

              <OakAccordion
                header="What is the difference between starter quizzes and exit quizzes?"
                id="accordion-quizzes"
              >
                <OakBox $pt="spacing-12">
                  <OakP $font="body-2">
                    Every lesson has a starter quiz - testing pupils on the
                    prior knowledge they will need for the lesson, and an exit
                    quiz - testing pupils’ understanding of the lesson’s
                    content. Each quiz has six questions. You can get these on a
                    per lesson or per subject/key stage basis.
                  </OakP>
                </OakBox>
              </OakAccordion>

              <OakAccordion
                header="What are the different types of content guidance?"
                id="accordion-content-guidance"
              >
                <OakBox $pt="spacing-12">
                  <OakP $font="body-2">
                    Content guidance warnings will fall into one of the
                    following four categories:
                  </OakP>
                  <OakUL>
                    <OakLI>Language and discrimination</OakLI>
                    <OakLI>Upsetting, disturbing and sensitive</OakLI>
                    <OakLI>Nudity and sex</OakLI>
                    <OakLI>
                      Physical activity and equipment requiring safe use
                    </OakLI>
                  </OakUL>
                </OakBox>
              </OakAccordion>

              <OakAccordion
                header="What does the supervision level ID mean?"
                id="accordion-supervision-level-id"
              >
                <OakBox $pt="spacing-12">
                  <OakP $font="body-2" $mb="spacing-12">
                    The lesson field ‘supervisionLevel’ returns the description
                    of the highest level of suggested guidance, so it is advised
                    to use this field rather than rely on the sub-guidance
                    levels.
                  </OakP>
                  <OakP $font="body-2">
                    However, the definitions of this ID are as follows:
                  </OakP>
                  <OakBox $ml="spacing-24" $mb="spacing-12">
                    <OakP $font="body-2">
                      <strong>1:</strong> Adult supervision suggested
                    </OakP>
                    <OakP $font="body-2">
                      <strong>2:</strong> Adult supervision recommended
                    </OakP>
                    <OakP $font="body-2">
                      <strong>3:</strong> Adult supervision required
                    </OakP>
                    <OakP $font="body-2">
                      <strong>4:</strong> Adult support required
                    </OakP>
                  </OakBox>
                  <OakP $font="body-2">
                    A description of the content is given, and content guidance
                    is suggested to help teachers better understand and prepare
                    for the lesson, as they know their students best.
                  </OakP>
                </OakBox>
              </OakAccordion>

              <OakAccordion
                header="Why are only some subjects/resources available?"
                id="accordion-limited-subjects"
              >
                <OakBox $pt="spacing-12">
                  <OakP $font="body-2">
                    We will have our fully resourced curricula for all subjects
                    available by Autumn 2025. We currently have fully resourced
                    curricula in English, Maths, Science, History, and Geography
                    (Primary). We will make all of these resources available
                    through the API, with an early release of a representative
                    subset available for the hackathon.
                  </OakP>
                </OakBox>
              </OakAccordion>

              <OakAccordion
                header="Why are there two search endpoints?"
                id="accordion-two-search-endpoints"
              >
                <OakBox $pt="spacing-12">
                  <OakP $font="body-2" $mb="spacing-12">
                    The API contains two different ways of searching for Oak
                    lessons because we have two different databases holding
                    those lessons.
                  </OakP>

                  <OakP $font="body-2" $mb="spacing-12">
                    The lesson search endpoint (/search/lessons) uses our main
                    Oak database to do a similarity search on lesson titles. The
                    transcript search (/search/transcripts) uses our AI
                    experiments database, which contains video transcripts for
                    each lesson and ‘snippets’ of those. The transcript search
                    does a similarity search on the video transcript ‘snippets’
                    for each lesson, so the same query can result in a different
                    set of lessons being returned than from the lesson search
                    endpoint. However, it does not have the ability to filter by
                    key stage, subject or unit that lesson search endpoint has.
                  </OakP>

                  <OakP $font="body-2">
                    We recommend you test both endpoints as one may be more
                    suitable and/or performant than the other depending on your
                    use case.
                  </OakP>
                </OakBox>
              </OakAccordion>

              <OakAccordion
                header="What is the difference between the assets and downloads endpoints?"
                id="accordion-assets-vs-downloads"
              >
                <OakBox $pt="spacing-12">
                  <OakP $font="body-2">
                    The available assets for each lesson may vary, so the assets
                    endpoints are used to get the available assets for a lesson
                    or group of lessons. The downloads endpoint, which the asset
                    endpoint provides for each available asset, then allows you
                    to download the asset in a zip.
                  </OakP>
                </OakBox>
              </OakAccordion>
            </LeftAlignedChildButtons>
            <OakP $font="body-2">
              If you need more help, please email us at{' '}
              <OakLink href="mailto:help@thenational.academy?subject=Oak%20OpenAPI">
                help@thenational.academy
              </OakLink>
              .
            </OakP>
            <OakP $font="body-2">
              When using our API key, please ensure you comply with our{' '}
              <OakLink href="https://www.thenational.academy/legal/terms-and-conditions">
                Terms and Conditions
              </OakLink>
            </OakP>
          </Feature>
          <Feature
            anchorTarget="give-feedback"
            title="Help us make the Oak Curriculum API better"
          >
            <OakP $font="body-2">
              Our API is new, and we strive to make it as accessible and suited
              to as many use cases as possible. It is designed to be flexible
              and easy to integrate into your existing systems. If you have
              feedback or are looking for an endpoint providing our content in a
              format you can&apos;t see, let us know, and we&apos;ll work with
              you to find a solution.
            </OakP>
            <OakTertiaryButton
              element="a"
              aria-label="Give feedback"
              href="https://survey.hsforms.com/1C1LX6MhoTWi2_3iF6Q6y3gbvumd"
              isTrailingIcon
              iconName="arrow-right"
            >
              Give feedback
            </OakTertiaryButton>
          </Feature>
        </OakGridArea>
      </OakGrid>
    </OakMaxWidth>
  );
}
